# 🧠 Kubernetes & EKS: Project Terminology

This document explains why we chose specific Kubernetes objects for the **Blink Chat Service** and how they function within our architecture.

> **Note**: For high-level architecture diagrams, please refer to the **[Blink-K8S.md](Blink-K8S.md)**.

---

## 🏗️ 1. Compute & Orchestration

### AWS EKS (Managed Kubernetes)
We use EKS so that AWS manages the "Control Plane" (the brain). We only manage the "Worker Nodes" (EC2 instances) where our pods run.

### Managed Node Groups
Our servers are `t3.medium` EC2 instances. They are "Managed", meaning AWS handles their patching and updates.

---

## 📦 2. Workload Types

### Deployments (Stateless)
- **Used for**: `chat-service` (Backend API).
- **Reason**: The backend doesn't store data locally. We can kill, restart, or scale it to 10 copies without losing information.

### StatefulSets (Stateful)
- **Used for**: `mongodb`.
- **Reason**: Databases need a stable identity. `mongodb-0` will always have the same name and the same disk attached, even if it restarts.

---

## 🚦 3. Networking & Traffic

### Services (Internal)
- **ClusterIP**: Used for internal communication. Our backend app finds MongoDB at `mongodb:27017` thanks to this service.

### Ingress & ALB (External)
- **Ingress**: A set of rules telling Kubernetes how to handle web traffic.
- **ALB Controller**: A robot that sees our "Ingress" and automatically builds an **AWS Application Load Balancer**.

---

## 💾 4. Persistence & Configuration

### PVC & StorageClass
- **PVC**: A request for a disk (e.g., "I need 10Gi for Mongo").
- **StorageClass (gp3)**: Defines the type of disk (AWS SSD).

### ConfigMaps & Secrets
- **ConfigMap**: For public settings (e.g., Environment names).
- **Secrets**: For sensitive data (e.g., Database passwords, JWT keys).

---

## ⚖️ 5. Scaling & Monitoring

### HPA (Horizontal Pod Autoscaler)
Automatically adds or removes backend pods based on CPU usage.

### Metrics Server
A small plugin that allows Kubernetes to "see" how much CPU/RAM each pod is using. Essential for HPA.

---
*Back to **[README.md](README.md)** | Start Deploying: **[DEPLOYMENT-STEPS.md](DEPLOYMENT-STEPS.md)**.*
