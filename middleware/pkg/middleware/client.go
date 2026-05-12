package middleware

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Event struct {
	Topic   string
	Payload json.RawMessage
}

type Client struct {
	brokers     []string
	mu          sync.Mutex
	rr          int
	conns       map[string]*brokerConn
	topicBroker map[string]string
}

type brokerConn struct {
	addr      string
	conn      net.Conn
	send      chan []byte
	pending   map[string]chan ackMessage
	subs      map[string]chan Event
	mu        sync.Mutex
	closed    chan struct{}
	closeOnce sync.Once
}

type ackMessage struct {
	Status string
	Info   string
}

type wireMessage struct {
	Type    string          `json:"type"`
	Topic   string          `json:"topic,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
	ReqID   string          `json:"req_id,omitempty"`
	Action  string          `json:"action,omitempty"`
	Status  string          `json:"status,omitempty"`
	Info    string          `json:"info,omitempty"`
	Message string          `json:"message,omitempty"`
}

var reqCounter uint64

func NewClient(brokers []string) *Client {
	clean := make([]string, 0, len(brokers))
	for _, b := range brokers {
		b = strings.TrimSpace(b)
		if b != "" {
			clean = append(clean, b)
		}
	}
	return &Client{
		brokers:     clean,
		conns:       make(map[string]*brokerConn),
		topicBroker: make(map[string]string),
	}
}

func (c *Client) Publish(ctx context.Context, topic string, payload any) (string, error) {
	if topic == "" {
		return "", errors.New("topic required")
	}
	payloadBytes, err := marshalPayload(payload)
	if err != nil {
		return "", err
	}

	addr, err := c.brokerForTopic(topic, true)
	if err != nil {
		return "", err
	}
	bc, err := c.connForAddr(addr)
	if err != nil {
		return "", err
	}

	req := wireMessage{
		Type:    "publish",
		Topic:   topic,
		Payload: payloadBytes,
		ReqID:   nextReqID(),
	}

	ack, err := bc.sendAndWait(ctx, req)
	if err != nil {
		return "", err
	}
	if ack.Status == "error" {
		return ack.Status, errors.New(ack.Info)
	}

	return ack.Status, nil
}

func (c *Client) Subscribe(ctx context.Context, topic string) (<-chan Event, error) {
	if topic == "" {
		return nil, errors.New("topic required")
	}

	addr, err := c.brokerForTopic(topic, true)
	if err != nil {
		return nil, err
	}
	bc, err := c.connForAddr(addr)
	if err != nil {
		return nil, err
	}

	events := make(chan Event, 128)
	bc.mu.Lock()
	if existing, ok := bc.subs[topic]; ok {
		bc.mu.Unlock()
		return existing, nil
	}
	bc.subs[topic] = events
	bc.mu.Unlock()

	req := wireMessage{Type: "subscribe", Topic: topic, ReqID: nextReqID()}
	ack, err := bc.sendAndWait(ctx, req)
	if err != nil {
		bc.mu.Lock()
		delete(bc.subs, topic)
		bc.mu.Unlock()
		close(events)
		return nil, err
	}

	if ack.Status != "ok" {
		bc.mu.Lock()
		delete(bc.subs, topic)
		bc.mu.Unlock()
		close(events)
		return nil, fmt.Errorf("subscribe failed: %s", ack.Info)
	}

	return events, nil
}

func (c *Client) Unsubscribe(ctx context.Context, topic string) error {
	if topic == "" {
		return errors.New("topic required")
	}

	addr, err := c.brokerForTopic(topic, false)
	if err != nil {
		return err
	}
	bc, err := c.connForAddr(addr)
	if err != nil {
		return err
	}

	req := wireMessage{Type: "unsubscribe", Topic: topic, ReqID: nextReqID()}
	ack, err := bc.sendAndWait(ctx, req)
	if err != nil {
		return err
	}
	if ack.Status != "ok" {
		return fmt.Errorf("unsubscribe failed: %s", ack.Info)
	}

	bc.mu.Lock()
	if ch, ok := bc.subs[topic]; ok {
		delete(bc.subs, topic)
		close(ch)
	}
	bc.mu.Unlock()

	return nil
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, bc := range c.conns {
		bc.closeWithError(errors.New("client closed"))
	}
	c.conns = make(map[string]*brokerConn)
	c.topicBroker = make(map[string]string)
	return nil
}

func (c *Client) brokerForTopic(topic string, create bool) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if addr, ok := c.topicBroker[topic]; ok {
		return addr, nil
	}
	if !create {
		return "", errors.New("topic not mapped")
	}
	if len(c.brokers) == 0 {
		return "", errors.New("no brokers configured")
	}
	addr := c.brokers[c.rr%len(c.brokers)]
	c.rr++
	c.topicBroker[topic] = addr
	return addr, nil
}

func (c *Client) connForAddr(addr string) (*brokerConn, error) {
	c.mu.Lock()
	bc := c.conns[addr]
	c.mu.Unlock()

	if bc != nil && !bc.isClosed() {
		return bc, nil
	}

	conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
	if err != nil {
		return nil, err
	}

	newConn := newBrokerConn(addr, conn)
	c.mu.Lock()
	c.conns[addr] = newConn
	c.mu.Unlock()
	return newConn, nil
}

func newBrokerConn(addr string, conn net.Conn) *brokerConn {
	bc := &brokerConn{
		addr:    addr,
		conn:    conn,
		send:    make(chan []byte, 256),
		pending: make(map[string]chan ackMessage),
		subs:    make(map[string]chan Event),
		closed:  make(chan struct{}),
	}

	go bc.writeLoop()
	go bc.readLoop()
	return bc
}

func (bc *brokerConn) sendAndWait(ctx context.Context, msg wireMessage) (ackMessage, error) {
	ackCh := make(chan ackMessage, 1)
	bc.mu.Lock()
	bc.pending[msg.ReqID] = ackCh
	bc.mu.Unlock()

	if err := bc.sendMessage(msg); err != nil {
		bc.mu.Lock()
		delete(bc.pending, msg.ReqID)
		bc.mu.Unlock()
		return ackMessage{}, err
	}

	select {
	case ack := <-ackCh:
		return ack, nil
	case <-ctx.Done():
		bc.mu.Lock()
		delete(bc.pending, msg.ReqID)
		bc.mu.Unlock()
		return ackMessage{}, ctx.Err()
	case <-bc.closed:
		return ackMessage{}, errors.New("connection closed")
	}
}

func (bc *brokerConn) sendMessage(msg wireMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	select {
	case bc.send <- data:
		return nil
	case <-bc.closed:
		return errors.New("connection closed")
	}
}

func (bc *brokerConn) readLoop() {
	scanner := bufio.NewScanner(bc.conn)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		var msg wireMessage
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "ack":
			bc.handleAck(msg)
		case "error":
			bc.handleError(msg)
		case "event":
			bc.handleEvent(msg)
		}
	}

	bc.closeWithError(errors.New("connection closed"))
}

func (bc *brokerConn) handleAck(msg wireMessage) {
	bc.mu.Lock()
	ch, ok := bc.pending[msg.ReqID]
	if ok {
		delete(bc.pending, msg.ReqID)
	}
	bc.mu.Unlock()

	if ok {
		ch <- ackMessage{Status: msg.Status, Info: msg.Info}
	}
}

func (bc *brokerConn) handleError(msg wireMessage) {
	bc.mu.Lock()
	ch, ok := bc.pending[msg.ReqID]
	if ok {
		delete(bc.pending, msg.ReqID)
	}
	bc.mu.Unlock()

	if ok {
		ch <- ackMessage{Status: "error", Info: msg.Message}
	}
}

func (bc *brokerConn) handleEvent(msg wireMessage) {
	bc.mu.Lock()
	ch := bc.subs[msg.Topic]
	bc.mu.Unlock()
	if ch == nil {
		return
	}

	select {
	case ch <- Event{Topic: msg.Topic, Payload: msg.Payload}:
	default:
	}
}

func (bc *brokerConn) writeLoop() {
	writer := bufio.NewWriter(bc.conn)
	for {
		select {
		case data, ok := <-bc.send:
			if !ok {
				return
			}
			if _, err := writer.Write(data); err != nil {
				bc.closeWithError(err)
				return
			}
			if err := writer.WriteByte('\n'); err != nil {
				bc.closeWithError(err)
				return
			}
			if err := writer.Flush(); err != nil {
				bc.closeWithError(err)
				return
			}
		case <-bc.closed:
			return
		}
	}
}

func (bc *brokerConn) closeWithError(err error) {
	bc.closeOnce.Do(func() {
		close(bc.closed)
		_ = bc.conn.Close()
		close(bc.send)

		bc.mu.Lock()
		for _, ch := range bc.pending {
			ch <- ackMessage{Status: "error", Info: err.Error()}
			close(ch)
		}
		for _, ch := range bc.subs {
			close(ch)
		}
		bc.pending = make(map[string]chan ackMessage)
		bc.subs = make(map[string]chan Event)
		bc.mu.Unlock()
	})
}

func (bc *brokerConn) isClosed() bool {
	select {
	case <-bc.closed:
		return true
	default:
		return false
	}
}

func nextReqID() string {
	seq := atomic.AddUint64(&reqCounter, 1)
	return fmt.Sprintf("r-%d-%d", time.Now().UnixNano(), seq)
}

func marshalPayload(payload any) (json.RawMessage, error) {
	if payload == nil {
		return nil, errors.New("payload required")
	}

	switch v := payload.(type) {
	case json.RawMessage:
		if len(v) == 0 {
			return nil, errors.New("payload required")
		}
		return v, nil
	case []byte:
		if len(v) == 0 {
			return nil, errors.New("payload required")
		}
		return json.RawMessage(v), nil
	default:
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		return json.RawMessage(data), nil
	}
}
