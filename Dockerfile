FROM node:26-bullseye AS builder

WORKDIR /devel
RUN apt-get update ; apt-get upgrade -y ; apt-get install -y build-essential
COPY . .
RUN npm i ; npm run build

FROM node:26-alpine

EXPOSE 8080
WORKDIR /exec
RUN apk add --update nodejs npm
COPY --from=builder /devel/ . 
RUN adduser -D jankclient

USER jankclient

CMD ["npm", "start"]
