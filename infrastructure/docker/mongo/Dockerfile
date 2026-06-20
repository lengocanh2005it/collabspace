FROM mongo:6
COPY docker-entrypoint-replset.sh /docker-entrypoint-replset.sh
RUN sed -i 's/\r$//' /docker-entrypoint-replset.sh && chmod +x /docker-entrypoint-replset.sh
ENTRYPOINT ["/docker-entrypoint-replset.sh"]
