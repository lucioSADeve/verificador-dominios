const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const domainQueue = require('./domainQueue');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para verificar disponibilidade de domínio no Registro.br
app.get('/api/check-domain/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const response = await axios.get(`https://registro.br/v2/ajax/avail/raw/${domain}`);
        
        res.json({
            domain: domain,
            available: response.data.status === 0,
            status: response.data.status,
            message: response.data.msg
        });
    } catch (error) {
        console.error('Erro ao verificar domínio:', error);
        res.status(500).json({ error: 'Erro ao verificar disponibilidade do domínio' });
    }
});

// Rota para adicionar lista de domínios para verificação
app.post('/api/check-domains/batch', async (req, res) => {
    try {
        const { domains } = req.body;
        
        if (!Array.isArray(domains)) {
            return res.status(400).json({ error: 'Lista de domínios inválida' });
        }

        // Limpar e validar domínios
        const validDomains = domains
            .map(d => d.trim().toLowerCase())
            .filter(d => d.endsWith('.com.br') || d.endsWith('.br'));

        domainQueue.addDomains(validDomains);
        
        res.json({ 
            message: `${validDomains.length} domínios adicionados à fila`,
            totalDomains: validDomains.length
        });
    } catch (error) {
        console.error('Erro ao adicionar domínios:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para verificar o progresso
app.get('/api/check-domains/progress', (req, res) => {
    const progress = domainQueue.getProgress();
    res.json(progress);
});

// Rota para baixar resultados
app.get('/api/download-results', (req, res) => {
    try {
        const results = {
            available: domainQueue.results.available,
            unavailable: domainQueue.results.unavailable,
            timestamp: new Date().toISOString()
        };
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao baixar resultados' });
    }
});

// Configuração da porta para o Render
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});