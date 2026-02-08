# Troubleshooting Guide

Common issues and solutions for EKS deployment.

---

## 📑 Table of Contents

1. [Cluster Issues](#cluster-issues)
2. [Pod Issues](#pod-issues)
3. [MongoDB Issues](#mongodb-issues)
4. [Networking Issues](#networking-issues)
5. [Ingress & ALB Issues](#ingress--alb-issues)
6. [Storage Issues](#storage-issues)
7. [Permission Issues](#permission-issues)
8. [Namespace Stuck in Terminating](#namespace-stuck-in-terminating)
9. [Debugging Commands](#debugging-commands)

---

## Cluster Issues

### Issue: Cannot connect to cluster

**Symptoms**:
```
Unable to connect to the server: dial tcp: lookup ... no such host
```

**Solution**:
```bash
# Update kubeconfig
aws eks update-kubeconfig --name blink-chat-service --region ap-south-1

# Verify
kubectl cluster-info

# Check current context
kubectl config current-context
```

---

### Issue: Nodes not ready

**Symptoms**:
```bash
kubectl get nodes
# NAME     STATUS     ROLES    AGE
# node-1   NotReady   <none>   5m
```

**Solution**:
```bash
# Describe node to see issue
kubectl describe node <node-name>

# Check node logs
kubectl logs -n kube-system -l k8s-app=aws-node

# Common fixes:
# 1. Wait 2-3 minutes for node to initialize
# 2. Check VPC CNI plugin
kubectl get pods -n kube-system | grep aws-node

# 3. Restart node (last resort)
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl delete node <node-name>
# Node will be recreated by node group
```

---

## Pod Issues

### Issue: Pods stuck in Pending

**Symptoms**:
```bash
kubectl get pods -n blink-chat
# NAME                 READY   STATUS    RESTARTS   AGE
# chat-service-xxx     0/1     Pending   0          5m
```

**Solution**:
```bash
# Check why pending
kubectl describe pod <pod-name> -n blink-chat

# Common reasons:
# 1. Insufficient resources
kubectl top nodes
# Solution: Add more nodes or reduce resource requests

# 2. PVC not bound
kubectl get pvc -n blink-chat
# Solution: Check storage class exists

# 3. Node selector mismatch
# Solution: Remove node selector or add matching labels to nodes
```

---

### Issue: Pods in CrashLoopBackOff

**Symptoms**:
```bash
kubectl get pods -n blink-chat
# NAME                 READY   STATUS             RESTARTS   AGE
# chat-service-xxx     0/1     CrashLoopBackOff   5          5m
```

**Solution**:
```bash
# Check logs
kubectl logs <pod-name> -n blink-chat

# Check previous container logs
kubectl logs <pod-name> -n blink-chat --previous

# Common causes:
# 1. Application error (check logs)
# 2. Missing environment variables
kubectl describe pod <pod-name> -n blink-chat | grep -A 10 "Environment"

# 3. Cannot connect to database
# Test from pod:
kubectl exec -it <pod-name> -n blink-chat -- curl http://mongo:27017

# 4. Liveness probe failing
# Check probe configuration in deployment.yaml
```

---

### Issue: Pods not ready (0/1)

**Symptoms**:
```bash
kubectl get pods -n blink-chat
# NAME                 READY   STATUS    RESTARTS   AGE
# chat-service-xxx     0/1     Running   0          5m
```

**Solution**:
```bash
# Check readiness probe
kubectl describe pod <pod-name> -n blink-chat | grep -A 5 "Readiness"

# Common issues:
# 1. Readiness probe failing
kubectl logs <pod-name> -n blink-chat | grep -i ready

# 2. Application not starting
kubectl logs <pod-name> -n blink-chat --tail=100

# 3. Port mismatch
# Verify application listens on correct port (8080)
kubectl exec -it <pod-name> -n blink-chat -- netstat -tlnp

# 4. Probe timeout too short
# Increase timeoutSeconds in deployment.yaml
```

---

### Issue: ImagePullBackOff

**Symptoms**:
```bash
kubectl get pods -n blink-chat
# NAME                 READY   STATUS             RESTARTS   AGE
# chat-service-xxx     0/1     ImagePullBackOff   0          2m
```

**Solution**:
```bash
# Check image name
kubectl describe pod <pod-name> -n blink-chat | grep Image

# Common fixes:
# 1. Image doesn't exist
# Verify image exists on Docker Hub

# 2. Private image without credentials
# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<username> \
  --docker-password=<password> \
  -n blink-chat

# Add to deployment.yaml:
# imagePullSecrets:
#   - name: regcred

# 3. Wrong image tag
# Update kustomization.yaml with correct tag
```

---

## MongoDB Issues

### Issue: MongoDB pod failing readiness/liveness probes

**Symptoms**:
```bash
kubectl get pods -n blink-chat
# NAME          READY   STATUS    RESTARTS   AGE
# mongodb-0     0/1     Running   3          5m

kubectl describe pod mongodb-0 -n blink-chat
# Readiness probe failed: command timed out
```

**Solution**:
```bash
# Check MongoDB logs
kubectl logs mongodb-0 -n blink-chat

# Test probe manually
kubectl exec -it mongodb-0 -n blink-chat -- \
  mongosh -u admin -p password --eval "db.adminCommand('ping')"

# Common fixes:
# 1. Increase probe timeout
# Edit databases/mongodb.yaml:
# readinessProbe:
#   timeoutSeconds: 5  # Increase from 1

# 2. Add authentication to probe
# Use: mongosh -u admin -p password --eval "..."

# 3. MongoDB not started yet
# Wait 2-3 minutes for MongoDB to initialize
```

---

### Issue: MongoDB data lost after pod restart

**Symptoms**:
- MongoDB pod restarted
- All data is gone

**Solution**:
```bash
# Check PVC status
kubectl get pvc -n blink-chat

# Verify PVC is bound
# STATUS should be "Bound"

# Check if PVC is mounted
kubectl describe pod mongodb-0 -n blink-chat | grep -A 5 "Mounts"

# If PVC not bound:
# 1. Check storage class exists
kubectl get storageclass

# 2. Check EBS CSI driver
kubectl get pods -n kube-system | grep ebs-csi

# 3. Recreate PVC
kubectl delete pvc mongo-storage-mongodb-0 -n blink-chat
kubectl delete pod mongodb-0 -n blink-chat
# StatefulSet will recreate both
```

---

## Networking Issues

### Issue: Pods cannot connect to MongoDB

**Symptoms**:
```
MongoSocketException: mongo: Name or service not known
```

**Solution**:
```bash
# Check MongoDB service exists
kubectl get svc mongo -n blink-chat

# Test DNS resolution from pod
kubectl exec -it deployment/chat-service -n blink-chat -- \
  nslookup mongo

# Test connection
kubectl exec -it deployment/chat-service -n blink-chat -- \
  curl http://mongo:27017

# Common fixes:
# 1. Service name mismatch
# Verify service name is "mongo" in:
# - databases/mongodb.yaml (Service metadata.name)
# - backend/secret.yaml (MONGODB_URI uses mongo:27017)

# 2. DNS not working
# Restart CoreDNS
kubectl rollout restart deployment coredns -n kube-system

# 3. Network policy blocking
# Check network policies
kubectl get networkpolicy -n blink-chat
```

---

### Issue: Cannot access application from outside

**Symptoms**:
- Ingress created but no ADDRESS
- ALB DNS doesn't respond

**Solution**:
```bash
# Check ingress
kubectl get ingress -n blink-chat

# If no ADDRESS:
# 1. Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=50

# 2. Check ALB controller is running
kubectl get pods -n kube-system | grep aws-load-balancer-controller

# 3. Check IAM permissions
# See "Permission Issues" section

# If ADDRESS exists but not responding:
# 1. Wait 2-3 minutes for ALB to be healthy
# 2. Check target group health in AWS Console
# 3. Check security groups allow traffic
```

---

## Ingress & ALB Issues

### Issue: ALB not created (Ingress has no ADDRESS)

**Symptoms**:
```bash
kubectl get ingress -n blink-chat
# NAME                 CLASS   HOSTS   ADDRESS   PORTS   AGE
# blink-chat-ingress   alb     *                 80      10m
```

**Solution**:
```bash
# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=100

# Common errors and fixes:

# 1. IAM permission denied
# Error: "User is not authorized to perform: elasticloadbalancing:..."
# Solution: Update IAM policy (see Permission Issues section)

# 2. Subnet tags missing
# Error: "unable to resolve at least 2 subnets"
# Solution: Tag subnets
aws ec2 create-tags \
  --resources subnet-xxx subnet-yyy \
  --tags Key=kubernetes.io/role/elb,Value=1

# 3. ALB controller not running
kubectl get deployment aws-load-balancer-controller -n kube-system
# Solution: Reinstall ALB controller

# 4. IngressClass not found
kubectl get ingressclass
# Solution: ALB controller creates this automatically
```

---

### Issue: ALB returns 503 Service Unavailable

**Symptoms**:
```bash
curl http://<ALB-DNS>
# <html><body><h1>503 Service Temporarily Unavailable</h1></body></html>
```

**Solution**:
```bash
# Check target group health in AWS Console
# Or check pod readiness
kubectl get pods -n blink-chat

# Common causes:
# 1. Pods not ready
# Solution: Fix pod readiness issues (see Pod Issues section)

# 2. Health check path wrong
# Verify health check path in ingress.yaml:
# alb.ingress.kubernetes.io/healthcheck-path: /actuator/health

# 3. Health check returns non-200
kubectl exec -it deployment/chat-service -n blink-chat -- \
  curl http://localhost:8080/actuator/health

# 4. Security group blocking
# Check security groups in AWS Console
```

---

### Issue: ALB returns 404 Not Found

**Symptoms**:
```bash
curl http://<ALB-DNS>/api/users
# 404 Not Found
```

**Solution**:
```bash
# Check ingress rules
kubectl describe ingress blink-chat-ingress -n blink-chat

# Verify path matches
# ingress.yaml should have:
# path: /
# pathType: Prefix

# Test directly on pod
kubectl port-forward deployment/chat-service 8080:8080 -n blink-chat
curl http://localhost:8080/api/users
```

---

## Storage Issues

### Issue: PVC stuck in Pending

**Symptoms**:
```bash
kubectl get pvc -n blink-chat
# NAME                      STATUS    VOLUME   CAPACITY
# mongo-storage-mongodb-0   Pending            
```

**Solution**:
```bash
# Check PVC events
kubectl describe pvc mongo-storage-mongodb-0 -n blink-chat

# Common causes:
# 1. Storage class doesn't exist
kubectl get storageclass
# Solution: Apply storage-class.yaml

# 2. EBS CSI driver not installed
kubectl get pods -n kube-system | grep ebs-csi
# Solution: Install EBS CSI driver
eksctl create addon --name aws-ebs-csi-driver \
  --cluster blink-chat-service --region ap-south-1 --force

# 3. No available volumes
# Check AWS EBS volume limits for your account

# 4. AZ mismatch
# Ensure PVC and pod are in same AZ
```

---

### Issue: Cannot delete PVC

**Symptoms**:
```bash
kubectl delete pvc mongo-storage-mongodb-0 -n blink-chat
# PVC stuck in Terminating state
```

**Solution**:
```bash
# Check what's using it
kubectl describe pvc mongo-storage-mongodb-0 -n blink-chat

# Delete pod using it first
kubectl delete pod mongodb-0 -n blink-chat

# If still stuck, remove finalizer
kubectl patch pvc mongo-storage-mongodb-0 -n blink-chat \
  -p '{"metadata":{"finalizers":null}}'

# Force delete
kubectl delete pvc mongo-storage-mongodb-0 -n blink-chat --force --grace-period=0
```

---

## Permission Issues

### Issue: ALB controller permission denied

**Symptoms**:
```
Error: User is not authorized to perform: elasticloadbalancing:DescribeListenerAttributes
```

**Solution**:
```bash
# Get current policy
aws iam get-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --version-id v1

# Download latest policy
curl -o /tmp/iam_policy.json \
  https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

# Update policy
aws iam create-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --policy-document file:///tmp/iam_policy.json \
  --set-as-default

# Restart ALB controller to get new credentials
kubectl delete pods -n kube-system \
  -l app.kubernetes.io/name=aws-load-balancer-controller
```

---

### Issue: EBS CSI driver permission denied

**Symptoms**:
```
Error: User is not authorized to perform: ec2:CreateVolume
```

**Solution**:
```bash
# Create IAM policy for EBS CSI
curl -o /tmp/ebs-csi-policy.json \
  https://raw.githubusercontent.com/kubernetes-sigs/aws-ebs-csi-driver/master/docs/example-iam-policy.json

aws iam create-policy \
  --policy-name AmazonEKS_EBS_CSI_Driver_Policy \
  --policy-document file:///tmp/ebs-csi-policy.json

# Attach to node IAM role
# Get node role ARN
aws eks describe-nodegroup \
  --cluster-name blink-chat-service \
  --nodegroup-name standard-workers \
  --region ap-south-1 \
  --query 'nodegroup.nodeRole'

# Attach policy
aws iam attach-role-policy \
  --role-name <node-role-name> \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/AmazonEKS_EBS_CSI_Driver_Policy
```

---

## Namespace Stuck in Terminating

### Issue: Cannot delete namespace

**Symptoms**:
```bash
kubectl delete namespace blink-chat
# Namespace stuck in "Terminating" state for minutes
```

**Solution**:

```bash
# Method 1: Remove finalizers
kubectl get namespace blink-chat -o json > /tmp/namespace.json

# Edit /tmp/namespace.json and remove "finalizers" section
# Then apply:
kubectl replace --raw "/api/v1/namespaces/blink-chat/finalize" \
  -f /tmp/namespace.json

# Method 2: Force delete (use with caution)
kubectl delete namespace blink-chat --force --grace-period=0

# Method 3: Delete stuck resources
# Find resources in namespace
kubectl api-resources --verbs=list --namespaced -o name \
  | xargs -n 1 kubectl get --show-kind --ignore-not-found -n blink-chat

# Delete each stuck resource
kubectl patch <resource-type> <resource-name> -n blink-chat \
  -p '{"metadata":{"finalizers":null}}'

# Common stuck resources:
# - PersistentVolumeClaims
# - Services (type LoadBalancer)
# - Ingress
```

---

## Debugging Commands

### General Debugging
```bash
# Get all resources in namespace
kubectl get all -n blink-chat

# Get events (sorted by time)
kubectl get events -n blink-chat --sort-by='.lastTimestamp'

# Describe resource (shows events and details)
kubectl describe <resource-type> <resource-name> -n blink-chat

# Get resource YAML
kubectl get <resource-type> <resource-name> -n blink-chat -o yaml

# Get resource JSON
kubectl get <resource-type> <resource-name> -n blink-chat -o json
```

### Pod Debugging
```bash
# Get pod logs
kubectl logs <pod-name> -n blink-chat

# Get logs from previous container (if crashed)
kubectl logs <pod-name> -n blink-chat --previous

# Follow logs (live)
kubectl logs -f <pod-name> -n blink-chat

# Get logs from all pods in deployment
kubectl logs deployment/chat-service -n blink-chat --all-containers=true

# Execute command in pod
kubectl exec -it <pod-name> -n blink-chat -- bash

# Test network from pod
kubectl exec -it <pod-name> -n blink-chat -- curl http://mongo:27017
kubectl exec -it <pod-name> -n blink-chat -- nslookup mongo
kubectl exec -it <pod-name> -n blink-chat -- ping mongo

# Check environment variables
kubectl exec <pod-name> -n blink-chat -- env

# Check processes
kubectl exec <pod-name> -n blink-chat -- ps aux
```

### Resource Usage
```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n blink-chat

# Pod resources with containers
kubectl top pods -n blink-chat --containers

# Describe node (shows allocated resources)
kubectl describe node <node-name>
```

### Network Debugging
```bash
# Get services
kubectl get svc -n blink-chat

# Get endpoints (pod IPs behind service)
kubectl get endpoints -n blink-chat

# Test service from another pod
kubectl run test-pod --image=curlimages/curl -it --rm -- sh
# Inside pod:
curl http://chat-service.blink-chat:8080/actuator/health

# Check DNS
kubectl run test-dns --image=busybox -it --rm -- nslookup mongo.blink-chat
```

### Storage Debugging
```bash
# Get PVCs
kubectl get pvc -n blink-chat

# Get PVs
kubectl get pv

# Describe PVC (shows events)
kubectl describe pvc <pvc-name> -n blink-chat

# Check what's using PVC
kubectl get pods -n blink-chat -o json | \
  jq '.items[] | select(.spec.volumes[]?.persistentVolumeClaim.claimName=="<pvc-name>") | .metadata.name'
```

### Ingress Debugging
```bash
# Get ingress
kubectl get ingress -n blink-chat

# Describe ingress (shows events)
kubectl describe ingress blink-chat-ingress -n blink-chat

# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=100

# Check ALB in AWS Console
# Go to EC2 → Load Balancers
# Check target group health
```

---

## Emergency Fixes

### Restart Everything
```bash
# Restart all backend pods
kubectl rollout restart deployment/chat-service -n blink-chat

# Restart MongoDB (causes downtime!)
kubectl delete pod mongodb-0 -n blink-chat

# Restart ALB controller
kubectl rollout restart deployment/aws-load-balancer-controller -n kube-system

# Restart CoreDNS (fixes DNS issues)
kubectl rollout restart deployment/coredns -n kube-system
```

### Reset Application
```bash
# Delete and recreate namespace
kubectl delete namespace blink-chat
kubectl apply -k .

# This will:
# - Delete all pods
# - Delete all data (PVCs)
# - Recreate everything fresh
```

### Reset Cluster
```bash
# Delete and recreate cluster
eksctl delete cluster --name blink-chat-service --region ap-south-1
# Then follow deployment steps again

# Warning: This deletes EVERYTHING
```

---

## Getting Help

If you're still stuck:

1. **Check logs**: `kubectl logs <pod-name> -n blink-chat`
2. **Check events**: `kubectl get events -n blink-chat --sort-by='.lastTimestamp'`
3. **Describe resource**: `kubectl describe <resource> -n blink-chat`
4. **Search error message**: Google the exact error message
5. **Check Kubernetes docs**: https://kubernetes.io/docs/
6. **Check AWS docs**: https://docs.aws.amazon.com/eks/

---

## Prevention Tips

1. **Always check logs before deleting pods**
2. **Use `kubectl describe` to see events**
3. **Test changes in dev environment first**
4. **Keep backups of important data**
5. **Monitor resource usage regularly**
6. **Set up alerts for pod failures**
7. **Document custom configurations**
8. **Use version control for manifests**

---

**Remember**: Most issues can be solved by checking logs and events! 🔍
