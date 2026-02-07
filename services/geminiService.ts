
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * ApexFlow AI Service
 * Optimized for Supply Chain Intelligence
 */

export interface AIContext {
    orders: any[];
    inventory: any[];
    customers: any[];
}

export const getAIResponseStream = async (prompt: string, context: AIContext, useSearch = false) => {
    const model = useSearch ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const systemInstruction = `
        You are the ApexFlow AI Strategist, an advanced assistant for a mobile parts distribution system.
        Your goal is to provide deep insights based on current business data.
        
        CURRENT DATA CONTEXT:
        - Total Orders: ${context.orders.length}
        - Total Inventory Items: ${context.inventory.length}
        - Customer Database Size: ${context.customers.length}
        
        DATA SNAPSHOT (JSON):
        ${JSON.stringify({
            lowStock: context.inventory.filter(i => i.quantity < 10).map(i => `${i.brand} ${i.model} (${i.quantity} left)`),
            pendingOrders: context.orders.filter(o => o.status === 'fresh' || o.status === 'assigned').length,
            highBalanceCustomers: context.customers.filter(c => c.balance < -5000).map(c => `${c.name}: ${c.balance}`)
        })}

        RULES:
        1. Be concise and professional.
        2. Use Markdown for formatting (bold, lists, tables).
        3. If data is not available, state it clearly.
        4. When using search grounding, always explain the source of market trends.
        5. Prioritize internal data over general knowledge for business queries.
    `;

    const config: any = {
        systemInstruction,
        temperature: 0.7,
    };

    if (useSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    return ai.models.generateContentStream({
        model,
        contents: prompt,
        config
    });
};
