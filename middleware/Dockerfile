# Stage 1: Build
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files (go.sum is optional - this module has no external deps)
COPY go.mod go.sum* ./

# Download dependencies
RUN go mod download

# Copy source
COPY . .

# Build broker, publisher, subscriber
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/broker ./cmd/broker && \
    CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/publisher ./cmd/publisher && \
    CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/subscriber ./cmd/subscriber

# Stage 2: Runtime
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy binaries from builder
COPY --from=builder /app/broker .
COPY --from=builder /app/publisher .
COPY --from=builder /app/subscriber .

# Expose ports
EXPOSE 9000 9100

# Default: start broker
CMD ["./broker", "-client-addr", ":9000", "-peer-addr", ":9100"]
