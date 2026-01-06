# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by opening a private issue or contacting the maintainers directly.

**Do not** disclose security vulnerabilities publicly until they have been addressed.

## Security Considerations

### Agent Sandboxing

Agents run in the same process as the framework. If running untrusted agents:

- Consider running matches in isolated containers
- Set strict timeouts
- Monitor resource usage

### Event Logs

Event logs may contain sensitive information about agent behavior. Be careful when sharing logs publicly.

### LLM Agents

When using LLM agents via OpenRouter:

- **API Keys**: Store API keys in environment variables, never in code
- **Rate Limiting**: Be aware of API rate limits and costs
- **Response Validation**: LLM responses are validated before execution
- **Fallback Behavior**: Invalid actions fall back to first legal action

### Runner Service

When deploying the match runner service:

- Use environment variables for all secrets
- Deploy in isolated environments
- Monitor for unusual activity
- Set appropriate resource limits

### No Real-Money Features

This framework does not include any real-money gambling, betting, or payment features. Any such features should be implemented in separate, properly regulated systems.
