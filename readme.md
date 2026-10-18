Document Service

This service runs in kubernetes environment and lists the documents in the mounted directory in the UI.
When clicked to open the document, it opens it in a new browser tab.

The NodeJS DocumentService listens to 3000 port

1. Start Docker Desktop
2. Start Kubernetes Cluster
3. kubectl apply -f storage.yaml
   kubectl apply -f deployment.yaml

4. Run Following commands to copy the files to the mounted storage in kubernetes:
Currently mac folder does not directly gets mounted to kubernetes because of some Docker VM overlay issue. We are not fighting that for now.

kubectl cp /Users/playmaker/mydocs/one.pdf default/$(kubectl get pod -l app=docapp -o jsonpath='{.items[0].metadata.name}'):/mnt/documents/one.pdf

5. localhost:3002
