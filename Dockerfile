FROM node:8-slim
MAINTAINER Nathan Smith <nathanrandal@gmail.com>

WORKDIR /opt/pkg
COPY package.json ./
RUN yarn install
VOLUME /opt/pkg/node_modules

COPY lib test ./
CMD bash
