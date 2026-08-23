// OpenAPI 3.0 specification for the Ebbyforms API.
// Served interactively at /api-docs and as raw JSON at /api-docs.json.
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Ebbyforms API',
    version: '1.0.0',
    description:
      'REST API for Ebbyforms — Express 5 + Sequelize/MySQL. Clerk owns authentication ' +
      '(email/password, OAuth, sessions); protected endpoints accept a Clerk session token ' +
      'as `Authorization: Bearer <token>` and return the app-side user profile.'
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  tags: [{ name: 'System' }, { name: 'Users' }, { name: 'Internal' }],
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Public liveness probe — no authentication required.',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } }
              }
            }
          }
        }
      }
    },
    '/api/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        description:
          'Returns the app-side profile for the signed-in Clerk user. Requires a Clerk session ' +
          'token (`Authorization: Bearer <token>`). On a user\'s first request the profile row ' +
          'is created from the session claims.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'The signed-in user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user'],
                  properties: {
                    user: { $ref: '#/components/schemas/User' }
                  }
                },
                example: {
                  user: {
                    id: 1,
                    clerkId: 'user_2abc123',
                    email: 'ada@example.com',
                    emailVerified: true,
                    firstName: 'Ada',
                    lastName: 'Lovelace',
                    imageUrl: 'https://img.clerk.com/...',
                    createdAt: '2026-08-24T00:00:00.000Z',
                    updatedAt: '2026-08-24T00:00:00.000Z'
                  }
                }
              }
            }
          },
          '401': {
            description: 'Missing or invalid Clerk session token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Unauthorized' }
              }
            }
          }
        }
      }
    },
    '/api/internal/stats': {
      get: {
        tags: ['Internal'],
        summary: 'Portal headline counts',
        description:
          'Staff-only. Returns total user and organization counts from Clerk. ' +
          'Requires a Clerk session token AND a staff/admin role (publicMetadata.role).',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Counts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: { type: 'integer', example: 1284 },
                    organizations: { type: 'integer', example: 37 }
                  }
                }
              }
            }
          },
          '401': { description: 'Not signed in', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized' } } } },
          '403': { description: 'Signed in but not staff', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Forbidden' } } } }
        }
      }
    },
    '/api/internal/users': {
      get: {
        tags: ['Internal'],
        summary: 'List users (all tenants)',
        description: 'Staff-only. Proxies Clerk\'s user list with role metadata.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': {
            description: 'Paginated user list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    users: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string', format: 'email', nullable: true },
                          firstName: { type: 'string', nullable: true },
                          lastName: { type: 'string', nullable: true },
                          imageUrl: { type: 'string', nullable: true },
                          role: { type: 'string', example: 'customer' },
                          createdAt: { type: 'integer', nullable: true },
                          lastActiveAt: { type: 'integer', nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Not signed in', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized' } } } },
          '403': { description: 'Signed in but not staff', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Forbidden' } } } }
        }
      }
    },
    '/api/internal/organizations': {
      get: {
        tags: ['Internal'],
        summary: 'List organizations (tenants)',
        description: 'Staff-only. Proxies Clerk\'s organization list.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': {
            description: 'Paginated organization list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    organizations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          slug: { type: 'string', nullable: true },
                          membersCount: { type: 'integer' },
                          createdAt: { type: 'integer', nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Not signed in', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized' } } } },
          '403': { description: 'Signed in but not staff', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Forbidden' } } } }
        }
      },
      post: {
        tags: ['Internal'],
        summary: 'Create an organization (tenant)',
        description: 'Staff-only. { name, slug? } — slug is used for the org URL.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Organization created' },
          '400': { description: 'Name required' },
          '401': { description: 'Not signed in' },
          '403': { description: 'Not internal staff' }
        }
      }
    },
    '/api/internal/users/{id}/role': {
      patch: {
        tags: ['Internal'],
        summary: 'Set a user\'s platform role',
        description:
          'Staff-only. Updates the users table and mirrors the role into Clerk\'s publicMetadata. ' +
          'Roles: internal, admin, staff, customer.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Clerk user ID (user_...)' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: { role: { type: 'string', enum: ['internal', 'admin', 'staff', 'customer'] } }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Updated user row',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { user: { type: 'object' } } }
              }
            }
          },
          '400': { description: 'Invalid role', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Not signed in', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized' } } } },
          '403': { description: 'Not internal staff', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Forbidden' } } } }
        }
      }
    },
    '/api/internal/organizations/{id}/members': {
      get: {
        tags: ['Internal'],
        summary: 'List an organization\'s members',
        description: 'Staff-only. Every membership of the tenant, with role and profile data.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Organization ID (org_...)' }],
        responses: {
          '200': {
            description: 'Member list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    members: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          role: { type: 'string', example: 'admin' },
                          userId: { type: 'string', nullable: true },
                          email: { type: 'string', nullable: true },
                          firstName: { type: 'string', nullable: true },
                          lastName: { type: 'string', nullable: true },
                          createdAt: { type: 'integer', nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Not signed in', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Unauthorized' } } } },
          '403': { description: 'Not internal staff', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: 'Forbidden' } } } }
        }
      },
      post: {
        tags: ['Internal'],
        summary: 'Add a member to an organization',
        description: 'Staff-only. { email, role } with role one of admin | basic_member.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Organization ID (org_...)' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'basic_member'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Member added' },
          '400': { description: 'Invalid role or missing email' },
          '401': { description: 'Not signed in' },
          '403': { description: 'Not internal staff' },
          '404': { description: 'No user with that email' }
        }
      }
    },
    '/api/internal/organizations/{id}/members/{userId}': {
      delete: {
        tags: ['Internal'],
        summary: 'Remove a member from an organization',
        description: 'Staff-only.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Organization ID (org_...)' },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, description: 'Clerk user ID (user_...)' }
        ],
        responses: {
          '200': { description: 'Member removed' },
          '401': { description: 'Not signed in' },
          '403': { description: 'Not internal staff' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Clerk session token, obtained by signing in on the frontend. Fetch it with ' +
          '`useAuth().getToken()` or from the `__session` cookie.'
      }
    },
    schemas: {
      User: {
        type: 'object',
        description: 'App-side profile, keyed by Clerk user ID',
        properties: {
          id: { type: 'integer', description: 'Local auto-increment primary key', example: 1 },
          clerkId: {
            type: 'string',
            description: "The user's Clerk user ID (user_...); the join key with Clerk",
            example: 'user_2abc123'
          },
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'Mirrored from Clerk session claims',
            example: 'ada@example.com'
          },
          emailVerified: {
            type: 'boolean',
            description: 'True for Clerk-authenticated users',
            example: true
          },
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          imageUrl: { type: 'string', nullable: true, description: 'Avatar URL from Clerk' },
          createdAt: { type: 'string', format: 'date-time', description: 'Sequelize timestamp' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Sequelize timestamp' }
        }
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', description: 'Human-readable error message' } }
      }
    }
  }
};
