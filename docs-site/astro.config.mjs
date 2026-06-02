import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://albertoarena.github.io',
  base: '/github-traffic-badge',
  integrations: [
    starlight({
      title: 'github-traffic-badge',
      description:
        'A GitHub Action that renders a customisable SVG traffic badge from real repository traffic data.',
      social: {
        github: 'https://github.com/albertoarena/github-traffic-badge',
      },
      editLink: {
        baseUrl:
          'https://github.com/albertoarena/github-traffic-badge/edit/main/docs-site/',
      },
      sidebar: [
        { label: 'Introduction', slug: 'index' },
        { label: 'Quick start', slug: 'quick-start' },
        { label: 'Configuration', slug: 'configuration' },
        { label: 'How it works', slug: 'how-it-works' },
        { label: 'Examples', slug: 'examples' },
        { label: 'Contributing', slug: 'contributing' },
      ],
    }),
  ],
});
