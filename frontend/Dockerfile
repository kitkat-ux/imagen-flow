FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy as template — nginx image runs envsubst at startup to replace ${BACKEND_HOST}
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
