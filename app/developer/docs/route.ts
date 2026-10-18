import { ApiReference } from '@scalar/nextjs-api-reference';

export const GET = ApiReference({
  pageTitle: 'NexusOps API Reference',
  theme: 'purple',
  hideModels: false,
  spec: { url: '/api/openapi' },
});
