---
title: Real-Time Sandalwood Tree Monitoring
date: 2025-06-10
subtitle: IoT and big-data surveillance
excerpt: A distributed IoT pipeline that watches sandalwood trees for signs of illegal cutting.
tags: [iot, kafka, spark, big-data]
links:
  - { label: GitHub, href: https://github.com/IshaanNene/AllCaps }
---
Sensors report temperature, humidity, vibration and sound over MQTT. A bridge feeds Kafka, Spark Streaming detects anomalies, Elasticsearch and Kibana serve live dashboards and alerts, and Hadoop HDFS keeps the history for trend analysis.
