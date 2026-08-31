FROM node:20-alpine
WORKDIR /collector

COPY collector/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY collector/*.mjs ./

ENV NODE_ENV=production
CMD ["node", "index.mjs"]
