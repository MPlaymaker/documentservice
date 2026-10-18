

The NodeJS DocumentService is listening to 3000 port

Start Docker Desktop

Start Kubernetes Cluster

kubectl apply -f storage.yaml
kubectl apply -f deployment.yaml

kubectl cp /Users/playmaker/mydocs/one.pdf default/$(kubectl get pod -l app=docapp -o jsonpath='{.items[0].metadata.name}'):/mnt/documents/one.pdf

localhost:3002
