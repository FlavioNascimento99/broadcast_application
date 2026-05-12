package main

import (
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"middleware_messaging/internal/broker"
)

func main() {
	clientAddr := flag.String("client-addr", ":9000", "client listen address")
	peerAddr := flag.String("peer-addr", ":9100", "peer listen address")
	peerList := flag.String("peers", "", "comma-separated peer addresses")
	id := flag.String("id", "", "broker id (optional)")
	flag.Parse()

	brokerID := *id
	if brokerID == "" {
		brokerID = randomID()
	}

	var peers []string
	if *peerList != "" {
		for _, part := range strings.Split(*peerList, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				peers = append(peers, part)
			}
		}
	}

	b := broker.NewBroker(brokerID, *clientAddr, *peerAddr, peers)
	if err := b.Start(); err != nil {
		log.Fatalf("broker start failed: %v", err)
	}

	select {}
}

func randomID() string {
	return fmt.Sprintf("broker-%d", time.Now().UnixNano())
}
