import { defineConfig } from 'vite';

// load the key from the environment variable from ANTHROPIC_API_KEY
// and inject it into the global variable __ANTHROPIC_API_KEY__

const apiKey = process.env.ANTHROPIC_API_KEY;

export default defineConfig({
    define: {
        // Inject the API key as a global variable
        __ANTHROPIC_API_KEY__: JSON.stringify(apiKey),
    },
});