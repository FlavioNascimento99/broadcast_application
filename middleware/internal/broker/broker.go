package broker

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"
)

type Broker struct {
	id         string
	clientAddr string
	peerAddr   string
	peerAddrs  []string

	topics   map[string]*topic
	topicsMu sync.RWMutex

	peers   map[string]*peerConn
	peersMu sync.RWMutex

	remoteTopics map[string]map[string]struct{}
	remoteMu     sync.RWMutex

	seen    map[string]time.Time
	seenMu  sync.Mutex
	seenTTL time.Duration
}

type topic struct {
	name string
	subs map[string]*client
	mu   sync.RWMutex
}

type client struct {
	id        string
	conn      net.Conn
	send      chan []byte
	closed    chan struct{}
	closeOnce sync.Once
}

type peerConn struct {
	id        string
	addr      string
	conn      net.Conn
	send      chan []byte
	closed    chan struct{}
	closeOnce sync.Once
}

func NewBroker(id, clientAddr, peerAddr string, peers []string) *Broker {
	return &Broker{
		id:           id,
		clientAddr:   clientAddr,
		peerAddr:     peerAddr,
		peerAddrs:    peers,
		topics:       make(map[string]*topic),
		peers:        make(map[string]*peerConn),
		remoteTopics: make(map[string]map[string]struct{}),
		seen:         make(map[string]time.Time),
		seenTTL:      30 * time.Second,
	}
}

func (b *Broker) Start() error {
	clientLn, err := net.Listen("tcp", b.clientAddr)
	if err != nil {
		return err
	}

	peerLn, err := net.Listen("tcp", b.peerAddr)
	if err != nil {
		_ = clientLn.Close()
		return err
	}

	log.Printf("broker id=%s client=%s peer=%s", b.id, b.clientAddr, b.peerAddr)
	go b.acceptClients(clientLn)
	go b.acceptPeers(peerLn)
	go b.seenCleanupLoop()

	for _, addr := range b.peerAddrs {
		addr = strings.TrimSpace(addr)
		if addr == "" || addr == b.peerAddr {
			continue
		}
		go b.peerDialer(addr)
	}

	return nil
}

func (b *Broker) acceptClients(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("client accept error: %v", err)
			continue
		}
		go b.handleClient(conn)
	}
}

func (b *Broker) acceptPeers(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("peer accept error: %v", err)
			continue
		}
		go b.handlePeer(conn, "inbound", "")
	}
}

func (b *Broker) peerDialer(addr string) {
	for {
		if b.hasPeerAddr(addr) {
			time.Sleep(3 * time.Second)
			continue
		}

		conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
		if err != nil {
			time.Sleep(3 * time.Second)
			continue
		}

		b.handlePeer(conn, "outbound", addr)
		time.Sleep(1 * time.Second)
	}
}

func (b *Broker) handleClient(conn net.Conn) {
	c := newClient(conn)
	go c.writeLoop()

	subscribed := make(map[string]struct{})
	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		var msg wireMessage
		if err := json.Unmarshal(line, &msg); err != nil {
			b.sendError(c, "", "invalid json")
			continue
		}

		switch msg.Type {
		case msgTypeSubscribe:
			b.handleSubscribe(c, subscribed, msg)
		case msgTypeUnsubscribe:
			b.handleUnsubscribe(c, subscribed, msg)
		case msgTypePublish:
			b.handlePublish(c, msg)
		default:
			b.sendError(c, msg.ReqID, "unknown type")
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("client read error: %v", err)
	}

	c.close()
	for topic := range subscribed {
		if b.removeSubscriber(topic, c) {
			b.broadcastTopicUpdate(peerTopicRemove, topic)
		}
	}
}

func (b *Broker) handleSubscribe(c *client, subscribed map[string]struct{}, msg wireMessage) {
	if msg.Topic == "" {
		b.sendAck(c, msg, "error", "topic required")
		return
	}

	if _, ok := subscribed[msg.Topic]; ok {
		b.sendAck(c, msg, "ok", "already subscribed")
		return
	}

	first := b.addSubscriber(msg.Topic, c)
	subscribed[msg.Topic] = struct{}{}
	if first {
		b.broadcastTopicUpdate(peerTopicAdd, msg.Topic)
	}

	b.sendAck(c, msg, "ok", "")
}

func (b *Broker) handleUnsubscribe(c *client, subscribed map[string]struct{}, msg wireMessage) {
	if msg.Topic == "" {
		b.sendAck(c, msg, "error", "topic required")
		return
	}

	if _, ok := subscribed[msg.Topic]; !ok {
		b.sendAck(c, msg, "ok", "not subscribed")
		return
	}

	delete(subscribed, msg.Topic)
	if b.removeSubscriber(msg.Topic, c) {
		b.broadcastTopicUpdate(peerTopicRemove, msg.Topic)
	}

	b.sendAck(c, msg, "ok", "")
}

func (b *Broker) handlePublish(c *client, msg wireMessage) {
	if msg.Topic == "" {
		b.sendAck(c, msg, "error", "topic required")
		return
	}
	if len(msg.Payload) == 0 {
		b.sendAck(c, msg, "error", "payload required")
		return
	}

	local, remote := b.hasAnySubscribers(msg.Topic)
	if !local && !remote {
		b.sendAck(c, msg, "discarded", "no subscribers")
		return
	}

	id := newID()
	b.markSeen(id)

	if local {
		b.dispatchLocal(msg.Topic, msg.Payload)
	}
	if remote {
		b.forwardPeerPublish(id, msg.Topic, msg.Payload, b.id)
	}

	b.sendAck(c, msg, "delivered", "")
}

func (b *Broker) addSubscriber(topicName string, c *client) bool {
	b.topicsMu.Lock()
	t, ok := b.topics[topicName]
	if !ok {
		t = &topic{name: topicName, subs: make(map[string]*client)}
		b.topics[topicName] = t
	}
	b.topicsMu.Unlock()

	t.mu.Lock()
	_, exists := t.subs[c.id]
	t.subs[c.id] = c
	count := len(t.subs)
	t.mu.Unlock()

	return !exists && count == 1
}

func (b *Broker) removeSubscriber(topicName string, c *client) bool {
	b.topicsMu.RLock()
	t, ok := b.topics[topicName]
	b.topicsMu.RUnlock()
	if !ok {
		return false
	}

	t.mu.Lock()
	delete(t.subs, c.id)
	count := len(t.subs)
	t.mu.Unlock()

	if count == 0 {
		b.topicsMu.Lock()
		delete(b.topics, topicName)
		b.topicsMu.Unlock()
		return true
	}

	return false
}

func (b *Broker) dispatchLocal(topicName string, payload json.RawMessage) {
	b.topicsMu.RLock()
	t := b.topics[topicName]
	b.topicsMu.RUnlock()
	if t == nil {
		return
	}

	msg := wireMessage{Type: msgTypeEvent, Topic: topicName, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	t.mu.RLock()
	for _, sub := range t.subs {
		sub.enqueue(data)
	}
	t.mu.RUnlock()
}

func (b *Broker) sendAck(c *client, req wireMessage, status string, info string) {
	msg := wireMessage{
		Type:   msgTypeAck,
		Action: req.Type,
		Topic:  req.Topic,
		Status: status,
		Info:   info,
		ReqID:  req.ReqID,
	}
	b.sendToClient(c, msg)
}

func (b *Broker) sendError(c *client, reqID string, message string) {
	msg := wireMessage{Type: msgTypeError, Message: message, ReqID: reqID}
	b.sendToClient(c, msg)
}

func (b *Broker) sendToClient(c *client, msg wireMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	c.enqueue(data)
}

func (b *Broker) hasAnySubscribers(topicName string) (bool, bool) {
	local := false
	remote := false

	b.topicsMu.RLock()
	t := b.topics[topicName]
	b.topicsMu.RUnlock()
	if t != nil {
		t.mu.RLock()
		local = len(t.subs) > 0
		t.mu.RUnlock()
	}

	b.remoteMu.RLock()
	if peers, ok := b.remoteTopics[topicName]; ok {
		remote = len(peers) > 0
	}
	b.remoteMu.RUnlock()

	return local, remote
}

func (b *Broker) broadcastTopicUpdate(updateType string, topicName string) {
	msg := wireMessage{Type: updateType, Topic: topicName, BrokerID: b.id}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	b.peersMu.RLock()
	for _, peer := range b.peers {
		peer.enqueue(data)
	}
	b.peersMu.RUnlock()
}

func (b *Broker) forwardPeerPublish(id string, topicName string, payload json.RawMessage, origin string) {
	msg := wireMessage{Type: peerPublish, ID: id, Topic: topicName, Payload: payload, Origin: origin}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	b.peersMu.RLock()
	for _, peer := range b.peers {
		if peer.id == origin {
			continue
		}
		peer.enqueue(data)
	}
	b.peersMu.RUnlock()
}

func (b *Broker) handlePeer(conn net.Conn, direction string, addr string) {
	p := newPeerConn(conn, addr)
	go p.writeLoop()

	if direction == "outbound" {
		b.sendPeerHello(p)
	}

	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		var msg wireMessage
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}

		if msg.Type == peerHello {
			if msg.BrokerID == "" || msg.BrokerID == b.id {
				continue
			}
			p.id = msg.BrokerID
			if msg.PeerAddr != "" {
				p.addr = msg.PeerAddr
			}
			if !b.registerPeer(p) {
				p.close()
				return
			}
			b.sendTopicSnapshot(p)
			if direction == "inbound" {
				b.sendPeerHello(p)
			}
			continue
		}

		if p.id == "" {
			continue
		}

		switch msg.Type {
		case peerTopicAdd:
			b.handlePeerTopicUpdate(p, msg, true)
		case peerTopicRemove:
			b.handlePeerTopicUpdate(p, msg, false)
		case peerPublish:
			b.handlePeerPublish(p, msg)
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("peer read error: %v", err)
	}

	p.close()
	if p.id != "" {
		b.unregisterPeer(p.id)
	}
}

func (b *Broker) sendPeerHello(p *peerConn) {
	msg := wireMessage{Type: peerHello, BrokerID: b.id, PeerAddr: b.peerAddr}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	p.enqueue(data)
}

func (b *Broker) sendTopicSnapshot(p *peerConn) {
	b.topicsMu.RLock()
	defer b.topicsMu.RUnlock()

	for name, t := range b.topics {
		t.mu.RLock()
		hasSubs := len(t.subs) > 0
		t.mu.RUnlock()
		if !hasSubs {
			continue
		}

		msg := wireMessage{Type: peerTopicAdd, Topic: name, BrokerID: b.id}
		data, err := json.Marshal(msg)
		if err != nil {
			continue
		}
		p.enqueue(data)
	}
}

func (b *Broker) handlePeerTopicUpdate(p *peerConn, msg wireMessage, add bool) {
	if msg.BrokerID == "" || msg.BrokerID == b.id || msg.Topic == "" {
		return
	}

	changed := b.applyRemoteTopic(msg.BrokerID, msg.Topic, add)
	if !changed {
		return
	}

	forward := wireMessage{Type: msg.Type, BrokerID: msg.BrokerID, Topic: msg.Topic}
	data, err := json.Marshal(forward)
	if err != nil {
		return
	}

	b.peersMu.RLock()
	for _, peer := range b.peers {
		if peer.id == p.id {
			continue
		}
		peer.enqueue(data)
	}
	b.peersMu.RUnlock()
}

func (b *Broker) handlePeerPublish(p *peerConn, msg wireMessage) {
	if msg.ID == "" || msg.Topic == "" || len(msg.Payload) == 0 {
		return
	}
	if msg.Origin == b.id {
		return
	}
	if b.isSeen(msg.ID) {
		return
	}

	b.markSeen(msg.ID)
	b.dispatchLocal(msg.Topic, msg.Payload)
	b.forwardPeerPublish(msg.ID, msg.Topic, msg.Payload, msg.Origin)
}

func (b *Broker) applyRemoteTopic(brokerID, topicName string, add bool) bool {
	b.remoteMu.Lock()
	defer b.remoteMu.Unlock()

	peers, ok := b.remoteTopics[topicName]
	if !ok {
		peers = make(map[string]struct{})
		b.remoteTopics[topicName] = peers
	}

	_, exists := peers[brokerID]
	if add {
		if exists {
			return false
		}
		peers[brokerID] = struct{}{}
		return true
	}

	if !exists {
		return false
	}
	delete(peers, brokerID)
	if len(peers) == 0 {
		delete(b.remoteTopics, topicName)
	}
	return true
}

func (b *Broker) hasPeerAddr(addr string) bool {
	b.peersMu.RLock()
	defer b.peersMu.RUnlock()
	for _, peer := range b.peers {
		if sameAddr(peer.addr, addr) {
			return true
		}
	}
	return false
}

func sameAddr(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	ah, ap, aerr := net.SplitHostPort(a)
	bh, bp, berr := net.SplitHostPort(b)
	if aerr == nil && berr == nil {
		if ap != bp {
			return false
		}
		if ah == bh {
			return true
		}
		if ah == "" || ah == "0.0.0.0" || ah == "::" {
			return true
		}
		if bh == "" || bh == "0.0.0.0" || bh == "::" {
			return true
		}
	}
	return a == b
}

func (b *Broker) registerPeer(p *peerConn) bool {
	b.peersMu.Lock()
	defer b.peersMu.Unlock()

	if existing, ok := b.peers[p.id]; ok {
		if !existing.isClosed() {
			return false
		}
	}

	b.peers[p.id] = p
	return true
}

func (b *Broker) unregisterPeer(peerID string) {
	b.peersMu.Lock()
	delete(b.peers, peerID)
	b.peersMu.Unlock()

	b.remoteMu.Lock()
	for topicName, peers := range b.remoteTopics {
		if _, ok := peers[peerID]; ok {
			delete(peers, peerID)
			if len(peers) == 0 {
				delete(b.remoteTopics, topicName)
			}
		}
	}
	b.remoteMu.Unlock()
}

func (b *Broker) markSeen(id string) {
	b.seenMu.Lock()
	b.seen[id] = time.Now()
	b.seenMu.Unlock()
}

func (b *Broker) isSeen(id string) bool {
	b.seenMu.Lock()
	defer b.seenMu.Unlock()
	seenAt, ok := b.seen[id]
	if !ok {
		return false
	}
	if time.Since(seenAt) > b.seenTTL {
		delete(b.seen, id)
		return false
	}
	return true
}

func (b *Broker) seenCleanupLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		cutoff := time.Now().Add(-b.seenTTL)
		b.seenMu.Lock()
		for id, t := range b.seen {
			if t.Before(cutoff) {
				delete(b.seen, id)
			}
		}
		b.seenMu.Unlock()
	}
}

func newClient(conn net.Conn) *client {
	return &client{
		id:     newID(),
		conn:   conn,
		send:   make(chan []byte, 256),
		closed: make(chan struct{}),
	}
}

func (c *client) enqueue(data []byte) {
	select {
	case c.send <- data:
	default:
	}
}

func (c *client) writeLoop() {
	writer := bufio.NewWriter(c.conn)
	for {
		select {
		case data, ok := <-c.send:
			if !ok {
				return
			}
			if _, err := writer.Write(data); err != nil {
				c.close()
				return
			}
			if err := writer.WriteByte('\n'); err != nil {
				c.close()
				return
			}
			if err := writer.Flush(); err != nil {
				c.close()
				return
			}
		case <-c.closed:
			return
		}
	}
}

func (c *client) close() {
	c.closeOnce.Do(func() {
		close(c.closed)
		_ = c.conn.Close()
		close(c.send)
	})
}

func newPeerConn(conn net.Conn, addr string) *peerConn {
	return &peerConn{
		conn:   conn,
		addr:   addr,
		send:   make(chan []byte, 256),
		closed: make(chan struct{}),
	}
}

func (p *peerConn) enqueue(data []byte) {
	select {
	case p.send <- data:
	default:
	}
}

func (p *peerConn) writeLoop() {
	writer := bufio.NewWriter(p.conn)
	for {
		select {
		case data, ok := <-p.send:
			if !ok {
				return
			}
			if _, err := writer.Write(data); err != nil {
				p.close()
				return
			}
			if err := writer.WriteByte('\n'); err != nil {
				p.close()
				return
			}
			if err := writer.Flush(); err != nil {
				p.close()
				return
			}
		case <-p.closed:
			return
		}
	}
}

func (p *peerConn) close() {
	p.closeOnce.Do(func() {
		close(p.closed)
		_ = p.conn.Close()
		close(p.send)
	})
}

func (p *peerConn) isClosed() bool {
	select {
	case <-p.closed:
		return true
	default:
		return false
	}
}

func newID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
