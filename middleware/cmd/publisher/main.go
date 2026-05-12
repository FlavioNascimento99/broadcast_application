package main

import (
	"context"
	"flag"
	"log"
	"strings"
	"time"

	"middleware_messaging/pkg/middleware"
)

func main() {
	brokersFlag := flag.String("brokers", "localhost:9000", "comma-separated broker client addresses")
	topic := flag.String("topic", "", "topic name")
	name := flag.String("name", "publisher", "publisher name")
	interval := flag.Duration("interval", time.Second, "publish interval")
	count := flag.Int("count", 0, "number of messages (0 = forever)")
	flag.Parse()

	if *topic == "" {
		log.Fatal("topic is required")
	}

	brokers := strings.Split(*brokersFlag, ",")
	client := middleware.NewClient(brokers)
	defer client.Close()

	ctx := context.Background()
	seq := 0
	for {
		seq++
		payload := map[string]any{
			"publisher": *name,
			"seq":       seq,
			"time":      time.Now().Format(time.RFC3339Nano),
		}

		status, err := client.Publish(ctx, *topic, payload)
		if err != nil {
			log.Printf("publish error: %v", err)
		} else if status == "discarded" {
			log.Printf("discarded (no subscribers) topic=%s", *topic)
		}

		if *count > 0 && seq >= *count {
			break
		}
		time.Sleep(*interval)
	}
}
