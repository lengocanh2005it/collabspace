# build.sh
#!/bin/bash
docker build -t "$1" "$2"

# test.sh
#!/bin/bash
npm install
npm test

# deploy.sh
#!/bin/bash
docker-compose -f docker-compose.yml up -d "$1"