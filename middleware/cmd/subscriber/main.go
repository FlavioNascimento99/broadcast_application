package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"middleware_messaging/pkg/middleware"
)

func main() {
	brokersFlag := flag.String("brokers", "localhost:9000", "comma-separated broker client addresses")
	topicsFlag := flag.String("topics", "", "comma-separated topics")
	name := flag.String("name", "subscriber", "subscriber name")
	flag.Parse()

	if *topicsFlag == "" {
		log.Fatal("topics are required")
	}

	topics := splitCSV(*topicsFlag)
	brokers := strings.Split(*brokersFlag, ",")
	client := middleware.NewClient(brokers)
	defer client.Close()

	ctx := context.Background()
	for _, topic := range topics {
		ch, err := client.Subscribe(ctx, topic)
		if err != nil {
			log.Fatalf("subscribe failed: %v", err)
		}

		go func(t string, events <-chan middleware.Event) {
			for evt := range events {
				fmt.Printf("[%s] topic=%s payload=%s\n", *name, t, string(evt.Payload))
			}
		}(topic, ch)
	}

	for {
		time.Sleep(5 * time.Second)
	}
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
