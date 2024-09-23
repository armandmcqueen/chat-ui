import {LitElement, html, css, unsafeCSS} from 'lit';
import "./index.css";
import { state } from 'lit/decorators.js';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicError } from "@anthropic-ai/sdk/error";
import Message = Anthropic.Message;
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { markedHighlight } from "marked-highlight";
import { config } from './config.js';
import style from "./index.css?inline";



import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import highlightStyle from 'highlight.js/styles/github-dark-dimmed.css?inline';



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
    if (this.messages.length === 0 && config.prepopulateChat) {
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
      { role: 'assistant', content: "Sure! Here's an example of how you might use async/await to load data for a web application:\n\n```javascript\nasync function loadData() {\n  try {\n    const response = await fetch('https://api.example.com/data');\n    if (!response.ok) {\n      throw new Error('Failed to load data');\n    }\n    const data = await response.json();\n    console.log('Data loaded:', data);\n    return data;\n  } catch (error) {\n    console.error('Error:', error.message);\n  }\n}\n\n// Usage\nloadData();\n```\n\nIn this example, we use the `fetch` API to load data from a URL and handle any errors that might occur during the process.\n\nAnd here's more random code\n```javascript\nasync function loadData() {\n  try {\n    const response = await fetch('https://api.example.com/data');\n    if (!response.ok) {\n      throw new Error('Failed to load data');\n```" },
    ];
    this.saveChatState();
  }

  static override styles = css`
    ${unsafeCSS(highlightStyle)}
    .collapsible {
      background-color: #f2efe7;
      color: #444;
      cursor: pointer;
      padding: 10px;
      width: 100%;
      border: none;
      text-align: left;
      outline: none;
      font-size: 15px;
    }

    .content {
      // display: block; /* Make code blocks visible by default */
      overflow: hidden;
      background-color: #f9f9f9;
      padding: 0 18px;
    }
  `;

  override render() {
    return html`
      <style type="text/css">${style.toString()}</style>
      <div class="max-w-3xl mx-auto p-5 pb-24 bg-[#f2efe7] rounded-lg chatoutput">
        ${this.messages.map(message => html`
          <div class="flex items-start mb-4 animate-fadeIn">
            ${message.role === 'user' 
              ? html`<div class="w-6 h-6 rounded-lg mr-3 bg-[#5eb89a] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">🗨️</div>`
              : ''}
            <div class="leading-relaxed flex-grow py-0.5 px-2 rounded-lg shadow-sm ${message.role === 'user' ? 'bg-[#e2ddcc]' : 'bg-[#f7f7f5]'}">
              ${unsafeHTML(this.formatMessage(message.content))}
            </div>
          </div>
        `)}
        ${this.isWaiting ? html`
          <div class="flex items-start mb-4 animate-fadeIn">
            <div class="w-6 h-6 rounded-lg mr-3 bg-[#5eb89a] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">C</div>
            <div class="flex-grow p-3 rounded-lg shadow-sm bg-[#f7f7f5]">
              ${unsafeHTML(this.formatMessage(this.streamingMessage))}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="fixed bottom-0 left-0 right-0 max-w-3xl mx-auto flex gap-2 p-4 bg-[#f2efe7] border-t border-[#d9d9e3]">
        <input
          type="text"
          .value=${this.userInput}
          @input=${this._onInput}
          @keyup=${this._onKeyUp}
          placeholder="Send a message..."
          ?disabled=${this.isWaiting}
          class="flex-grow p-2 border border-[#d9d9e3] rounded-lg text-base bg-white focus:outline-none focus:border-[#8e8ea0]"
        >
        <div class="flex gap-2">
          ${this.isWaiting
            ? html`<button @click=${this._onCancel} class="p-2 bg-[#ff4f4f] text-white border border-[#d9d9e3] rounded-lg cursor-pointer text-base transition-colors hover:bg-[#ff3333] disabled:opacity-50 disabled:cursor-not-allowed" ?disabled=${this.isCancelling}>Cancel</button>`
            : html`<button @click=${this._onSubmit} class="p-2 bg-white text-[#1a1a1a] border border-[#d9d9e3] rounded-lg cursor-pointer text-base transition-colors hover:bg-[#f3f3f3] disabled:opacity-50 disabled:cursor-not-allowed" ?disabled=${this.isWaiting}>Send</button>`
          }
          <button @click=${this.clearChatState} class="p-2 bg-[#ff4f4f] text-white border border-[#d9d9e3] rounded-lg cursor-pointer text-base transition-colors hover:bg-[#ff3333]">Clear</button>
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

    // Wrap code blocks in a collapsible container
    const collapsibleContent = sanitizedContent.replace(/<pre><code/g, '<button class="collapsible">Toggle Code</button><div class="content visible"><pre><code');
    return collapsibleContent.replace(/<\/code><\/pre>/g, '</code></pre></div>');
  }

  override firstUpdated() {
    this.addCollapsibleListeners();
  }

  override updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('messages') || changedProperties.has('isWaiting') || changedProperties.has('streamingMessage')) {
      this._scrollToBottom();
    }
    // this.addCollapsibleListeners();
  }

  private addCollapsibleListeners() {
    this.shadowRoot?.querySelectorAll('.collapsible').forEach(button => {
      button.addEventListener('click', () => {
        const content = button.nextElementSibling as HTMLElement;
        if (content.classList.contains('visible')) {
          content.classList.remove('visible');
          content.classList.add('hidden');
        } else {
          content.classList.remove('hidden');
          content.classList.add('visible');
        }
      });
    });
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
    this.saveChatState();
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

  private clearChatState() {
    localStorage.removeItem('chatState');
    this.messages = [];
    this.userInput = '';
    this.isWaiting = false;
    this.streamingMessage = '';
    this.isCancelling = false;
    this.requestUpdate();
  }

}

customElements.define('claude-clone', ClaudeClone);