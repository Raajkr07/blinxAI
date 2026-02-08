# 🚀 Step-by-Step Deployment Guide

Follow these commands in sequence to deploy the **Blink Chat Service** on a fresh AWS EKS cluster.

---

## 🛠️ Phase 1: Environment Setup

### 1.1 Configure AWS CLI
```bash
aws configure
aws sts get-caller-identity
```

### 1.2 Create EKS Cluster
```bash
eksctl create cluster \
  --name blink-chat-service \
  --region ap-south-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --managed
```

---

## 💾 Phase 2: Add-ons & Controllers

### 2.1 Install EBS Storage Driver
```bash
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster blink-chat-service \
  --region ap-south-1 \
  --force
```

### 2.2 Install Metrics Server (For HPA)
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### 2.3 Setup ALB Ingress Controller
```bash
# 1. Create IAM Policy
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json

# 2. Create Service Account
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
eksctl create iamserviceaccount \
  --cluster=blink-chat-service \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve --region=ap-south-1

# 3. Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=blink-chat-service \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

---

## 🚀 Phase 3: Application Deployment

### 3.1 Prepare Secrets (Base64)
```bash
# Encode each secret and update backend/secret.yaml
echo -n 'your_value' | base64
```

### 3.2 Launch Resources
```bash
kubectl apply -k .
```

### 3.3 Verify & Get URL
```bash
# Check pod status
kubectl get pods -n blink-chat

# Get ALB DNS Address
kubectl get ingress -n blink-chat
```

---

## 🧹 Phase 4: Cleanup
```bash
eksctl delete cluster --name blink-chat-service --region ap-south-1
```

---
*For troubleshooting, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.*
