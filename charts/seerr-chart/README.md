# seerr-chart

![Version: 3.0.0](https://img.shields.io/badge/Version-3.0.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 2.7.3](https://img.shields.io/badge/AppVersion-2.7.3-informational?style=flat-square)

Seerr helm chart for Kubernetes

**Homepage:** <https://github.com/seerr-team/seerr>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| Seerr Team |  | <https://github.com/orgs/seerr-team/people> |

## Source Code

* <https://github.com/seerr-team/seerr/tree/main/charts/seerr>

## Requirements

Kubernetes: `>=1.23.0-0`

## Installation

Refer to [https://docs.seerr.dev/getting-started/kubernetes](Seerr kubernetes documentation)

## Update Notes

### Updating to 3.0.0

Nothing has changed; we just rebranded the `jellyseerr` Helm chart to `seerr` 🥳.

### Updating to 2.7.0

Seerr is a stateful application and it is not designed to have multiple replicas. In version 2.7.0 we address this by:

- replacing `Deployment` with `StatefulSet`
- removing `replicaCount` value

If `replicaCount` value was used - remove it. Helm update should work fine after that.

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` |  |
| config | object | `{"persistence":{"accessModes":["ReadWriteOnce"],"annotations":{},"name":"","size":"5Gi","volumeName":""}}` | Creating PVC to store configuration |
| config.persistence.accessModes | list | `["ReadWriteOnce"]` | Access modes of persistent disk |
| config.persistence.annotations | object | `{}` | Annotations for PVCs |
| config.persistence.name | string | `""` | Config name |
| config.persistence.size | string | `"5Gi"` | Size of persistent disk |
| config.persistence.volumeName | string | `""` | Name of the permanent volume to reference in the claim. Can be used to bind to existing volumes. |
| extraEnv | list | `[]` | Environment variables to add to the seerr pods |
| extraEnvFrom | list | `[]` | Environment variables from secrets or configmaps to add to the seerr pods |
| fullnameOverride | string | `""` |  |
| image.pullPolicy | string | `"IfNotPresent"` |  |
| image.registry | string | `"ghcr.io"` |  |
| image.repository | string | `"seerr-team/seerr"` |  |
| image.sha | string | `""` |  |
| image.tag | string | `""` | Overrides the image tag whose default is the chart appVersion. |
| imagePullSecrets | list | `[]` |  |
| ingress.annotations | object | `{}` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hosts[0].host | string | `"chart-example.local"` |  |
| ingress.hosts[0].paths[0].path | string | `"/"` |  |
| ingress.hosts[0].paths[0].pathType | string | `"ImplementationSpecific"` |  |
| ingress.ingressClassName | string | `""` |  |
| ingress.tls | list | `[]` |  |
| nameOverride | string | `""` |  |
| nodeSelector | object | `{}` |  |
| podAnnotations | object | `{}` |  |
| podLabels | object | `{}` |  |
| podSecurityContext | object | `{}` |  |
| probes.livenessProbe | object | `{}` | Configure liveness probe |
| probes.readinessProbe | object | `{}` | Configure readiness probe |
| probes.startupProbe | string | `nil` | Configure startup probe |
| resources | object | `{}` |  |
| securityContext | object | `{}` |  |
| service.port | int | `80` |  |
| service.type | string | `"ClusterIP"` |  |
| serviceAccount.annotations | object | `{}` | Annotations to add to the service account |
| serviceAccount.automount | bool | `true` | Automatically mount a ServiceAccount's API credentials? |
| serviceAccount.create | bool | `true` | Specifies whether a service account should be created |
| serviceAccount.name | string | `""` | If not set and create is true, a name is generated using the fullname template |
| tolerations | list | `[]` |  |
| volumeMounts | list | `[]` | Additional volumeMounts on the output StatefulSet definition. |
| volumes | list | `[]` | Additional volumes on the output StatefulSet definition. |
