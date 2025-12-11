# @mediaserver/web

Web application built with Expo Web.

## Development

```bash
yarn nx run @mediaserver/web:start
```

## Notes

This app shares most of its code with the mobile app through:
- `@mediaserver/ui` - Shared components
- `@mediaserver/api-client` - API hooks
- `@mediaserver/core` - Types and utilities

The web app uses the same file-based routing structure as mobile but with web-specific optimizations:
- Server-side rendering where applicable
- Web-specific navigation (sidebar instead of tabs)
- Keyboard shortcuts
- PWA support

