FROM node:20-alpine
WORKDIR /app
COPY server.js .
COPY iron_county_daily_tracker.html .
EXPOSE 80
CMD ["node", "server.js"]
