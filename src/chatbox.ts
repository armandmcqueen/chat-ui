import {LitElement, css, html, unsafeCSS} from 'lit';
import { state } from 'lit/decorators.js';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicError } from "@anthropic-ai/sdk/error";
import Message = Anthropic.Message;
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { markedHighlight } from "marked-highlight";


import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import highlightStyle from 'highlight.js/styles/github.css?inline';



// Declare the global variable for TypeScript
declare global {
  const __ANTHROPIC_API_KEY__: string;
}

export class ClaudeClone extends LitElement {
  @state()
  private messages: { role: 'user' | 'assistant', content: string }[] = [];

  @state()
  private userInput = '';

  @state()
  private isWaiting = false;

  @state()
  private streamingMessage = '';

  @state()
  private isCancelling = false;

  private anthropic: Anthropic;
  private markedInstance: typeof marked;

  constructor() {
    super();
    this.anthropic = new Anthropic({
      apiKey: __ANTHROPIC_API_KEY__,
      dangerouslyAllowBrowser: true
    });

    // Configure marked to use highlight.js
    this.markedInstance = marked.setOptions({
      gfm: true,
      breaks: true,
    });
    this.markedInstance.use(
        markedHighlight({
          langPrefix: 'hljs language-',
          highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
          }
        })
    );

    // Load saved chat state
    this.loadChatState();

    // If no saved state, initialize with example messages
    if (this.messages.length === 0) {
      this.initializeExampleChat();
    }
  }

  private saveChatState() {
    localStorage.setItem('chatState', JSON.stringify(this.messages));
  }

  private loadChatState() {
    const savedState = localStorage.getItem('chatState');
    if (savedState) {
      this.messages = JSON.parse(savedState);
    }
  }

  private initializeExampleChat() {
    this.messages = [
      { role: 'user', content: 'Hello, Claude! Can you help me with a coding question?' },
      { role: 'assistant', content: "Of course! I'd be happy to help you with your coding question. What specific problem or concept would you like assistance with?" },
      { role: 'user', content: "I'm trying to understand how to use async/await in JavaScript. Can you explain it with an example?" },
      { role: 'assistant', content: "Certainly! Async/await is a way to work with asynchronous operations in JavaScript, making the code easier to read and write. Here's a simple example to illustrate how it works:\n\n```javascript\nasync function fetchUserData(userId) {\n  try {\n    const response = await fetch(`https://api.example.com/users/${userId}`);\n    if (!response.ok) {\n      throw new Error('Failed to fetch user data');\n    }\n    const userData = await response.json();\n    console.log('User data:', userData);\n    return userData;\n  } catch (error) {\n    console.error('Error:', error.message);\n  }\n}\n\n// Usage\nfetchUserData(123);\n```\n\nIn this example:\n\n1. We define an `async` function called `fetchUserData`.\n2. Inside the function, we use `await` to pause execution until the `fetch` operation completes.\n3. We check if the response is okay, and if not, we throw an error.\n4. We use `await` again to parse the JSON response.\n5. If any error occurs during this process, it's caught in the `catch` block.\n\nThe `async` keyword allows us to use `await` inside the function, and `await` pauses the execution of the function until the promise is resolved or rejected.\n\nThis approach allows you to write asynchronous code that looks and behaves more like synchronous code, making it easier to understand and maintain.\n\nDo you have any specific questions about async/await or would you like me to elaborate on any part of the explanation?" },
      { role: 'user', content: "That's helpful, thanks! Can you show me how to use this in a real-world scenario, like loading data for a web application?" },
    ];
    this.saveChatState();
  }

  static override styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #f2efe7;
      color: #1a1a1a;
      min-height: 100vh;
      position: relative;
    }
    .chat-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      padding-bottom: 80px;
    }
    .message {
      display: flex;
      align-items: flex-start;
      animation: fadeIn 0.3s ease-out;
      margin-bottom: 16px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .avatar {
      width: 24px;
      height: 24px;
      border-radius: 10px;
      margin-right: 12px;
      background-color: #5eb89a;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 8px;
      flex-shrink: 0;
    }
    .content {
      flex-grow: 1;
      padding: 12px 16px;
      border-radius: 6px;
      line-height: 1.5;
      overflow-wrap: break-word;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
    }
    .user .content {
      background-color: #e2ddcc;
    }
    .claude .content {
      background-color: #f7f7f5;
    }
    .user {
      align-items: center;
    }
    .user-input {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      gap: 10px;
      padding: 16px;
      background-color: #f2efe7;
      border-top: 1px solid #d9d9e3;
    }
    input {
      flex-grow: 1;
      padding: 10px 14px;
      border: 1px solid #d9d9e3;
      border-radius: 6px;
      font-size: 16px;
      background-color: #ffffff;
    }
    input:focus {
      outline: none;
      border-color: #8e8ea0;
    }
    button {
      padding: 10px 20px;
      background-color: #ffffff;
      color: #1a1a1a;
      border: 1px solid #d9d9e3;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: #f3f3f3;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .button-container {
      display: flex;
      gap: 10px;
    }
    .cancel-button {
      background-color: #ff4f4f;
      color: white;
    }
    .cancel-button:hover {
      background-color: #ff3333;
    }
    .content > *:first-child { margin-top: 0; }
    .content > *:last-child { margin-bottom: 0; }
    .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
      margin-top: 1em;
      margin-bottom: 0.5em;
      font-weight: bold;
    }
    .content h1 { font-size: 1.5em; }
    .content h2 { font-size: 1.3em; }
    .content h3 { font-size: 1.1em; }
    .content p { margin-bottom: 0.5em; }
    .content ul, .content ol {
      margin-top: 0.25em;
      margin-bottom: 0.5em;
      padding-left: 1.5em;
    }
    .content li { margin-bottom: 0.25em; }
    .content li > ul, .content li > ol { margin-top: 0.25em; margin-bottom: 0.25em; }
    .content code {
      background-color: #f0f0f0;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    .content pre {
      background-color: #f0f0f0;
      padding: 0.5em;
      border-radius: 5px;
      overflow-x: auto;
      margin: 0.5em 0;
    }
    .content pre code {
      background-color: transparent;
      padding: 0;
    }
    .content a { color: #0000EE; text-decoration: underline; }
    .content blockquote {
      border-left: 3px solid #ccc;
      margin: 0.5em 0;
      padding-left: 1em;
      color: #666;
    }
    .content table {
      border-collapse: collapse;
      margin: 0.5em 0;
    }
    .content th, .content td {
      border: 1px solid #ccc;
      padding: 0.3em 0.5em;
    }
    .content img {
      max-width: 100%;
      height: auto;
    }
    .content pre {
      margin: 0.5em 0;
      padding: 0;
    }
    .content pre code {
      display: block;
      padding: 0.5em;
      overflow-x: auto;
    }
    ${unsafeCSS(highlightStyle)}
  `;

  override render() {
    return html`
      <div class="chat-container">
        ${this.messages.map(message => html`
          <div class="message ${message.role === 'user' ? 'user' : 'claude'}">
            ${ message.role === 'user' ? html`<div class="avatar">🗨️</div>` : '' /* 👤️ */ }
<!--            <div class="avatar">${message.role === 'user' ? 'AM' : 'C'}</div>-->
            <div class="content">${unsafeHTML(this.formatMessage(message.content))}</div>
          </div>
        `)}
        ${this.isWaiting ? html`
          <div class="message claude">
            <div class="avatar">C</div>
            <div class="content">${unsafeHTML(this.formatMessage(this.streamingMessage))}</div>
          </div>
        ` : ''}
      </div>
      <div class="user-input">
        <input
            type="text"
            .value=${this.userInput}
            @input=${this._onInput}
            @keyup=${this._onKeyUp}
            placeholder="Send a message..."
            ?disabled=${this.isWaiting}
        >
        <div class="button-container">
          ${this.isWaiting
              ? html`<button @click=${this._onCancel} class="cancel-button" ?disabled=${this.isCancelling}>Cancel</button>`
              : html`<button @click=${this._onSubmit} ?disabled=${this.isWaiting}>Send</button>`
          }
        </div>
      </div>
    `;
  }

  private formatMessage(content: string): string {
    // Parse Markdown with syntax highlighting
    const parsedContent = this.markedInstance.parse(content) as string;
    // Sanitize the result
    const sanitizedContent = DOMPurify.sanitize(parsedContent, {
      ADD_ATTR: ['class'], // Allow the 'class' attribute for syntax highlighting
    });
    return sanitizedContent;
  }

  private _onInput(e: InputEvent) {
    this.userInput = (e.target as HTMLInputElement).value;
  }

  private _onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Enter' && !this.isWaiting) {
      this._onSubmit();
    }
  }

  private currentStream: MessageStream | null = null;

  private async _onSubmit() {
    if (this.userInput.trim() && !this.isWaiting) {
      const userMessage = { role: 'user' as const, content: this.userInput };
      this.messages = [...this.messages, userMessage];
      this.userInput = '';
      this.isWaiting = true;
      this.streamingMessage = '';
      this.saveChatState();
      this.requestUpdate();

      try {
        this.currentStream = this.anthropic.messages.stream({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 8192,
          messages: this.messages,
        });

        this.currentStream.on('connect', () => {
          console.log('Stream connected');
        });

        this.currentStream.on('text', (_: string, textSnapshot: string) => {
          this.streamingMessage = textSnapshot.trim();
          this.requestUpdate();
        });

        this.currentStream.on('error', (error: AnthropicError) => {
          console.error('Error in stream:', error);
          if (this.isCancelling) {
            console.log('Generation was cancelled.');
          } else {
            const errorMessage = { role: 'assistant' as const, content: "I'm sorry, I encountered an error. Please try again." };
            this.messages = [...this.messages, errorMessage];
          }
          this.handleStreamEnd();
        });

        // this.currentStream.on('abort', (error: APIUserAbortError) => {
        //   console.error('Steam aborted:', error);
        //   if (this.isCancelling) {
        //     console.log('Generation was cancelled.');
        //   } else {
        //     const errorMessage = { role: 'assistant' as const, content: "I'm sorry, stream was aborted. Please try again." };
        //     this.messages = [...this.messages, errorMessage];
        //   }
        //   this.handleStreamEnd();
        // });

        this.currentStream.on('finalMessage', (message: Message) => {
          if (!this.isCancelling) {
            // Confirm the message is a text message
            if (message.content[0].type === 'text') {
              const assistantMessage = { role: 'assistant' as const, content: message.content[0].text };
              this.messages = [...this.messages, assistantMessage];
            } else {
              console.error('Unexpected message type:', message.content[0].type);
            }
          }
          this.handleStreamEnd();
        });

        await this.currentStream.done();

      } catch (error) {
        if (this.isCancelling) {
            console.log('Generation was cancelled. Catch block');
        } else {
          console.error('Error calling Claude API:', error);
          const errorMessage = { role: 'assistant' as const, content: "I'm sorry, I encountered an error. Please try again." };
          this.messages = [...this.messages, errorMessage];
        }
        this.handleStreamEnd();
      }
    }
  }

  private handleStreamEnd() {
    this.isWaiting = false;
    this.isCancelling = false;
    this.currentStream = null;
    this.streamingMessage = '';
    this.requestUpdate();
  }

  private _onCancel() {
    if (this.currentStream) {
      this.isCancelling = true;
      this.currentStream.abort();
      const cancelMessage = { role: 'assistant' as const, content: "Generation was cancelled." };
      this.messages = [...this.messages, cancelMessage];
      // this.handleStreamEnd();
    }
  }

  private _scrollToBottom() {
    setTimeout(() => {
      const chatContainer = this.shadowRoot?.querySelector('.chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 0);
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('messages') || changedProperties.has('isWaiting') || changedProperties.has('streamingMessage')) {
      this._scrollToBottom();
    }
  }
}

customElements.define('claude-clone', ClaudeClone);