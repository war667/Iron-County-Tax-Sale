FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY iron_county_daily_tracker.html /usr/share/nginx/html/index.html
EXPOSE 80
