FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/

RUN npm install

# Собираем в правильном порядке
RUN npm run build --workspace=@agent-office/core
RUN npm run build --workspace=@agent-office/adapters
RUN npm run build --workspace=@agent-office/server
RUN npm run build --workspace=@agent-office/ui

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@agent-office/server"]
