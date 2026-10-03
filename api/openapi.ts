export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Scraper API',
    version: '1.0.0',
    description: 'API de importación federativa y actualización de estadísticas complementarias de jugadores.'
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'General' },
    { name: 'Federación' },
    { name: 'Estadísticas complementarias' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['General'],
        summary: 'Estado del servidor',
        responses: {
          '200': {
            description: 'Servidor disponible',
            content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, status: { type: 'string' } } } } }
          }
        }
      }
    },
    '/api/federation/options': {
      get: {
        tags: ['Federación'],
        summary: 'Obtener opciones de importación federativa',
        responses: { '200': { description: 'Catálogos de Federación' }, '503': { description: 'Supabase no está configurado' } }
      }
    },
    '/api/federation/import': {
      post: {
        tags: ['Federación'],
        summary: 'Importar payload de partido y play-by-play',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['statsPayload', 'pbpPayload'],
                properties: {
                  statsPayload: { type: 'object', description: 'Payload de estadísticas del partido' },
                  pbpPayload: { type: 'object', description: 'Payload de play-by-play' },
                  metadata: { type: 'object', additionalProperties: true },
                  sourceUrl: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Partido importado' }, '400': { description: 'Payload no válido' }, '500': { description: 'Error durante la importación' } }
      }
    },
    '/api/complementary-stats/options': {
      get: {
        tags: ['Estadísticas complementarias'],
        summary: 'Consultar opciones de catálogo filtradas',
        parameters: [
          {
            name: 'type', in: 'query', required: true,
            schema: { type: 'string', enum: ['seasons', 'categories', 'competitions', 'matchdays', 'matches', 'teams'] }
          },
          { name: 'seasonId', in: 'query', schema: { type: 'string' }, description: 'Requerido para categories y competitions' },
          { name: 'categoryId', in: 'query', schema: { type: 'string' }, description: 'Requerido para competitions' },
          { name: 'competitionId', in: 'query', schema: { type: 'string' }, description: 'Requerido para matchdays y matches' },
          { name: 'matchday', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Requerido para matches' },
          { name: 'matchId', in: 'query', schema: { type: 'string' }, description: 'Requerido para teams' }
        ],
        responses: {
          '200': { description: 'Opciones asociadas al contexto solicitado', content: { 'application/json': { schema: { $ref: '#/components/schemas/OptionsResponse' } } } },
          '400': { description: 'Tipo de catálogo o filtros no válidos' },
          '503': { description: 'Supabase no está configurado' }
        }
      }
    },
    '/api/complementary-stats/import': {
      post: {
        tags: ['Estadísticas complementarias'],
        summary: 'Actualizar estadísticas complementarias de un partido',
        security: [{ importToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ComplementaryImportRequest' } } }
        },
        responses: {
          '200': { description: 'Filas actualizadas' },
          '400': { description: 'Contexto, dorsal o estadística no válidos' },
          '401': { description: 'Token Bearer ausente o no válido' },
          '503': { description: 'Importación no configurada' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      importToken: { type: 'http', scheme: 'bearer', bearerFormat: 'token' }
    },
    schemas: {
      OptionsResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          options: { type: 'array', items: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'integer' }] }, name: { type: 'string' } } } }
        }
      },
      ComplementaryImportRequest: {
        type: 'object',
        required: ['context', 'rows'],
        properties: {
          context: {
            type: 'object',
            required: ['seasonId', 'categoryId', 'competitionId', 'matchday', 'matchId', 'teamId', 'includedMatchCount', 'confirmedSingleMatch'],
            properties: {
              seasonId: { type: 'string' }, categoryId: { type: 'string' }, competitionId: { type: 'string' },
              matchday: { type: 'integer', minimum: 1 }, matchId: { type: 'string' }, teamId: { type: 'string' },
              includedMatchCount: { type: 'integer', enum: [1] }, confirmedSingleMatch: { type: 'boolean', enum: [true] }
            }
          },
          rows: {
            type: 'array', minItems: 1, maxItems: 100,
            items: {
              type: 'object', required: [
                'jerseyNumber', 't2Made', 't2Attempted', 't3Made', 't3Attempted', 'tlMade', 'tlAttempted',
                'rebounds', 'assists', 'steals', 'turnovers'
              ],
              properties: {
                jerseyNumber: { type: 'string', pattern: '^\\d+$' }, playerName: { type: 'string' },
                t2Made: { type: 'integer', minimum: 0 }, t2Attempted: { type: 'integer', minimum: 0 },
                t3Made: { type: 'integer', minimum: 0 }, t3Attempted: { type: 'integer', minimum: 0 },
                tlMade: { type: 'integer', minimum: 0 }, tlAttempted: { type: 'integer', minimum: 0 },
                rebounds: { type: 'integer', minimum: 0 }, assists: { type: 'integer', minimum: 0 },
                steals: { type: 'integer', minimum: 0 }, turnovers: { type: 'integer', minimum: 0 }
              }
            }
          }
        }
      }
    }
  }
};