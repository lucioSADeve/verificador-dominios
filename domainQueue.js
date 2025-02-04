const Queue = require('better-queue');
const fs = require('fs');
const axios = require('axios');

class DomainQueueManager {
    constructor() {
        // Configurar a fila com delay entre requisições (1 segundo)
        this.queue = new Queue(async (domain, cb) => {
            try {
                // Aumenta o intervalo para 1 segundo para ser mais seguro
                await new Promise(resolve => setTimeout(resolve, 1000));
                const result = await this.checkDomain(domain);
                this.saveResult(result);
                
                // Log no console do servidor
                console.log(`Verificado: ${domain} - ${result.available ? 'DISPONÍVEL' : 'Indisponível'}`);
                
                cb(null, result);
            } catch (error) {
                // Se der erro de limite, espera 1 minuto antes de tentar novamente
                if (error.response?.status === 429) {
                    console.log('Limite atingido, aguardando 1 minuto...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    return this.checkDomain(domain);
                }
                console.error(`Erro ao verificar ${domain}:`, error.message);
                cb(error);
            }
        }, { 
            concurrent: 1,      // Processa um por vez
            maxRetries: 3,      // Número máximo de tentativas
            retryDelay: 5000    // 5 segundos entre tentativas
        });

        this.results = {
            available: [],
            unavailable: [],
            errors: []
        };

        // Criar pasta 'resultados' se não existir
        if (!fs.existsSync('resultados')) {
            fs.mkdirSync('resultados');
        }

        // Criar arquivo de log com timestamp
        this.logFile = `resultados/verificacao_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    }

    async checkDomain(domain) {
        try {
            const response = await axios.get(`https://registro.br/v2/ajax/avail/raw/${domain}`);
            return {
                domain,
                available: response.data.status === 0,
                status: response.data.status,
                message: response.data.msg
            };
        } catch (error) {
            console.error(`Erro ao verificar ${domain}:`, error.message);
            throw error;
        }
    }

    saveResult(result) {
        // Salva no array de resultados
        if (result.available) {
            this.results.available.push(result.domain);
            // Salva domínios disponíveis em arquivo separado
            fs.appendFileSync('resultados/dominios_disponiveis.txt', `${result.domain}\n`);
        } else {
            this.results.unavailable.push(result.domain);
        }

        // Salva log detalhado
        fs.appendFileSync(this.logFile, 
            `${new Date().toISOString()} - ${result.domain} - ` +
            `${result.available ? 'DISPONÍVEL' : 'Indisponível'} - ${result.message}\n`
        );
    }

    addDomains(domains) {
        console.log(`Adicionando ${domains.length} domínios à fila...`);
        domains.forEach(domain => {
            this.queue.push(domain);
        });
    }

    getProgress() {
        return {
            total: this.queue.length + this.results.available.length + this.results.unavailable.length,
            processed: this.results.available.length + this.results.unavailable.length,
            available: this.results.available.length,
            unavailable: this.results.unavailable.length,
            remaining: this.queue.length
        };
    }
}

// Exportação do gerenciador
const manager = new DomainQueueManager();
module.exports = manager;