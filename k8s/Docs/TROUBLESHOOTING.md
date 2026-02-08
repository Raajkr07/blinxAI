# 🛠️ Deep-Dive Troubleshooting

Detailed solutions for specific technical errors in the **Blink Chat Service** cluster.

---

## 🛑 Pod Lifecycle Errors

### 1. `CrashLoopBackOff`
*   **Likely Cause**: Application code failing on startup or missing sensitive secrets.
*   **Debugging**:
    ```bash
    kubectl logs <pod-name> -n blink-chat --previous
    ```
*   **Common Fix**: Check if `MONGO_URI` or `JWT_SECRET` are correctly encoded in `backend/secret.yaml`.

### 2. `Pending`
*   **Likely Cause**: Cluster has no free CPU/Memory or the Persistent Volume (EBS) is in a different Availability Zone (AZ).
*   **Debugging**:
    ```bash
    kubectl describe pod <pod-name> -n blink-chat
    ```

### 3. `ImagePullBackOff`
*   **Likely Cause**: The Docker image name/tag in `kustomization.yaml` doesn't match the one on Docker Hub/ECR.
*   **Fix**: Verify the image tag with `docker images` and update the manifest.

---

## 💾 Database & Storage Errors

### 1. MongoDB connectivity timed out
*   **Check**: Is the `mongo` service running?
    ```bash
    kubectl get svc mongo -n blink-chat
    ```
*   **Fix**: Ensure the backend pod is using the internal service DNS: `mongodb://mongo:27017`.

### 2. PVC stuck in "Waiting for first consumer"
*   **Solution**: This is normal in `gp3` storage with "WaitForFirstConsumer" binding. The volume will only create once the MongoDB Pod is assigned to a node.

---

## 🌐 Networking & Ingress Errors

### 1. Ingress has no Address (ALB not creating)
*   **Check Controller Logs**:
    ```bash
    kubectl logs -n kube-system deployment/aws-load-balancer-controller
    ```
*   **Common Fix**: Verify your subnets have the correct tags: `kubernetes.io/role/elb = 1`.

### 2. 503 Service Unavailable
*   **Cause**: The ALB is up, but it doesn't see healthy backend pods.
*   **Check**: Are your pods healthy?
    ```bash
    kubectl get pods -n blink-chat
    ```
*   **Fix**: Verify the `readinessProbe` path in your deployment manifest matches `/actuator/health`.

---

## 🚨 Emergency Cheat Sheet

| Situation | Action |
| :--- | :--- |
| **App hung?** | `kubectl rollout restart deployment/chat-service -n blink-chat` |
| **New secrets not working?** | `kubectl delete pods -n blink-chat` (to force config reload) |
| **Logs from all pods?** | `kubectl logs -l app=chat-service -n blink-chat` |
| **Check resource usage?** | `kubectl top pods -n blink-chat` |

---
*Back to **[K8S-DOCUMENTATION.md](K8S-DOCUMENTATION.md)**.*
