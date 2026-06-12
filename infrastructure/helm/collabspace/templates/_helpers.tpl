{{/*
CollabSpace Helm helpers
*/}}
{{- define "collabspace.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "collabspace.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "collabspace.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "collabspace.namespace" -}}
{{- default .Release.Namespace .Values.global.namespace }}
{{- end }}

{{- define "collabspace.labels" -}}
helm.sh/chart: {{ include "collabspace.chart" . }}
{{ include "collabspace.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: collabspace
{{- end }}

{{- define "collabspace.selectorLabels" -}}
app.kubernetes.io/name: {{ include "collabspace.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "collabspace.appLabels" -}}
app: {{ .appName }}
app.kubernetes.io/name: {{ .appName }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: collabspace
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end }}

{{- define "collabspace.postgresql.host" -}}
{{- $r := .root | default . -}}
{{- $r.Values.infra.hosts.postgresql | default "postgres" }}
{{- end }}

{{- define "collabspace.mongodb.host" -}}
{{- $r := .root | default . -}}
{{- $r.Values.infra.hosts.mongodb | default "mongo" }}
{{- end }}

{{- define "collabspace.redis.host" -}}
{{- $r := .root | default . -}}
{{- $r.Values.infra.hosts.redis | default "redis" }}
{{- end }}

{{- define "collabspace.rabbitmq.host" -}}
{{- $r := .root | default . -}}
{{- $r.Values.infra.hosts.rabbitmq | default "rabbitmq" }}
{{- end }}

{{- define "collabspace.jwtSecret" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.jwtSecret | required "global.secrets.jwtSecret is required" }}
{{- end }}

{{- define "collabspace.internalServiceToken" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.internalServiceToken | required "global.secrets.internalServiceToken is required" }}
{{- end }}

{{- define "collabspace.postgresPassword" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.postgresPassword | default $r.Values.postgresql.auth.password }}
{{- end }}

{{- define "collabspace.redisPassword" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.redisPassword | default $r.Values.redis.auth.password }}
{{- end }}

{{- define "collabspace.rabbitmqUser" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.rabbitmqUsername | default $r.Values.rabbitmq.auth.username }}
{{- end }}

{{- define "collabspace.rabbitmqPassword" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.rabbitmqPassword | default $r.Values.rabbitmq.auth.password }}
{{- end }}

{{- define "collabspace.rabbitmqUrl" -}}
{{- $r := .root | default . -}}
{{- $user := include "collabspace.rabbitmqUser" (dict "root" $r) | urlquery -}}
{{- $pass := include "collabspace.rabbitmqPassword" (dict "root" $r) | urlquery -}}
{{- printf "amqp://%s:%s@%s:5672/collabspace" $user $pass (include "collabspace.rabbitmq.host" (dict "root" $r)) }}
{{- end }}

{{- define "collabspace.mongoUri" -}}
{{- $r := .root | default . -}}
{{- $user := $r.Values.global.secrets.mongoUsername | default "admin" | urlquery -}}
{{- $pass := $r.Values.global.secrets.mongoPassword | default $r.Values.mongodb.auth.rootPassword | urlquery -}}
{{- $db := .database | default "collabspace_task" -}}
{{- printf "mongodb://%s:%s@%s:27017/%s?authSource=admin" $user $pass (include "collabspace.mongodb.host" (dict "root" $r)) $db }}
{{- end }}

{{- define "collabspace.postgresUrl" -}}
{{- $r := .root | default . -}}
{{- $db := .database | required "database name required for postgresUrl" -}}
{{- $pass := include "collabspace.postgresPassword" (dict "root" $r) | urlquery -}}
{{- printf "postgresql://postgres:%s@%s:5432/%s" $pass (include "collabspace.postgresql.host" (dict "root" $r)) $db }}
{{- end }}

{{- define "collabspace.mongoUsername" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.mongoUsername | default "admin" }}
{{- end }}

{{- define "collabspace.mongoPassword" -}}
{{- $r := .root | default . -}}
{{- $r.Values.global.secrets.mongoPassword | default $r.Values.mongodb.auth.rootPassword }}
{{- end }}
