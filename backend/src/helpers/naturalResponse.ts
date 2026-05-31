export async function generateNaturalResponse(context: string, userName: string): Promise<string> {
    try {
        const OpenAI = (await import('openai')).default;
        const groqClient = new OpenAI({
            apiKey: process.env.GROQ_API_KEY || '',
            baseURL: 'https://api.groq.com/openai/v1',
        });

        const response = await groqClient.chat.completions.create({
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            temperature: 0.5,
            messages: [
                {
                    role: 'system',
                    content: `Kamu adalah Moni, asisten keuangan keluarga yang profesional, informatif, and friendly. Panggil user "${userName}" atau "Kak". Bahasa Indonesia yang baik, jelas, dan to the point. JANGAN gunakan kata "gue", "lo", "cuy". Singkat 1-2 kalimat.`
                },
                { role: 'user', content: context }
            ],
            max_tokens: 60,
        });
        return response.choices[0]?.message?.content || 'Siap, Kak! 🚀';
    } catch {
        return 'Siap, Kak! 🚀';
    }
}
