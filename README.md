# Simulador de Colônia de Formigas — Rota de Entregas

Atividade prática de Colônia de Formigas · Inteligência Artificial · UFPI · 2026.2

- **Aplicação publicada:** https://mingridxs.github.io/ia-trabalho-cf/
- **Repositório:** https://github.com/mingridxs/ia-trabalho-cf

## Autores

- Maria Ingrid Xavier Sousa ([mingridxs](https://github.com/mingridxs))
- Carlos Henrique Reis Portela Leal ([CarlosRPL](https://github.com/CarlosRPL))

## Descrição da solução

Simulador, executado inteiramente no navegador, de otimização por colônia de formigas (variante **Ant System**) para planejar uma rota de entregas: um veículo sai do depósito, visita cada ponto exatamente uma vez e retorna ao depósito, minimizando a distância total.

- **Grafo:** completo e não direcionado, com vértices no plano e distância euclidiana d(i, j) = √((x(i) − x(j))² + (y(i) − y(j))²).
- **Solução:** sequência que começa no depósito, visita todos os demais vértices sem repetição e termina no depósito. O comprimento L soma todas as arestas, inclusive a de retorno.
- **Inicialização:** todas as arestas recebem o mesmo feromônio τ₀; a diagonal da matriz não recebe feromônio.
- **Construção das rotas:** em cada iteração, cada formiga parte do depósito e escolhe apenas vértices ainda não visitados. Para cada candidato j, o peso é w(i,j) = τ(i,j)^α × (1/d(i,j))^β e a probabilidade é p(i,j) = w(i,j) / Σ w(i,u), somando só os candidatos. O próximo vértice é sorteado proporcionalmente às probabilidades (roleta), e não pelo maior peso.
- **Atualização do feromônio:** todas as formigas da iteração usam os feromônios do fim da iteração anterior. Só depois que todas completam as rotas aplica-se τ_novo(i,j) = (1 − ρ) × τ_antigo(i,j) + Σ Δτk(i,j), em que cada formiga k deposita Q/Lk nas arestas que percorreu, inclusive a de retorno. A matriz é mantida simétrica, sem contar duas vezes a mesma formiga na mesma aresta, e há um piso de 10⁻¹² por aresta.
- **Registro:** melhor rota de cada iteração e melhor de toda a execução. A execução termina após o número configurado de iterações.

Distância e feromônio são coisas diferentes: a distância é um custo fixo da aresta; o feromônio é atualizado pelo algoritmo; o peso de escolha w combina os dois.

Ordem dos sorteios: as formigas constroem suas rotas uma após a outra; cada escolha com mais de um candidato consome um número do gerador (com um único candidato não há sorteio).

### Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Estrutura da página |
| `style.css` | Estilos, temas claro e escuro e layout responsivo |
| `aco.js` | Ant System: gerador com semente, distâncias, probabilidades, sorteio, construção das rotas, evaporação e depósito, validação das entradas e logs |
| `app.js` | Interface: campos, controles, grafo (SVG), métricas, gráfico, histórico e logs |
| `testes.js` | Testes da seção 6 (usados pela página e pelo terminal) |
| `rodar-testes.js` | Executa os testes no terminal com `node rodar-testes.js` |
| `favicon.svg`, `trilha.svg` | Ícone da página e fundo |

## Instruções de uso

1. Abra a aplicação publicada (ou o arquivo `index.html` em um navegador; não há instalação nem servidor).
2. A tela inicia com um cenário de 8 vértices e depósito em A. Edite identificadores e coordenadas, adicione ou remova vértices (de 4 a 12) e escolha o depósito. O botão **Carregar instância da seção 6.1** cadastra os vértices A, B, C e D e os parâmetros dos testes.
3. Ajuste os parâmetros. Qualquer alteração exige clicar em **Reiniciar**, que valida os campos, limpa o histórico, restaura τ₀ e restabelece a semente. Entradas inválidas bloqueiam a execução e são listadas em vermelho.
4. Controles:
   - **Executar:** roda as iterações em sequência, ou retoma de onde parou.
   - **Pausar:** interrompe preservando o estado.
   - **Avançar uma iteração:** completa exatamente uma iteração e permanece pausado.
   - **Reiniciar:** volta à iteração 0.
5. O controle "Intervalo entre iterações" muda apenas a velocidade visual; não altera os sorteios nem os resultados.
6. No **grafo**, a espessura e a intensidade de cada aresta acompanham o feromônio, a melhor rota acumulada aparece tracejada com setas e o depósito é o quadrado azul. Passe o cursor ou toque em uma aresta para consultar a distância e o feromônio; a tabela "Arestas" lista todos os valores, e a opção "Mostrar o valor de τ" escreve os números sobre as linhas.
7. A escala visual do feromônio é fixa durante toda a execução (de 0 até um limite superior teórico de τ para os parâmetros aplicados, informado abaixo do grafo). Assim, uma linha só engrossa quando o feromônio aumenta e só afina quando ele diminui.
8. As métricas mostram a iteração atual, a menor distância da iteração, a média das distâncias das formigas e a melhor distância acumulada. Na iteração 0, a melhor distância aparece como "ainda não calculada".
9. O **log da iteração** mostra a construção da rota da formiga escolhida (vértice atual, candidatos com τ, d, w e p, valor sorteado, vértice escolhido e retorno ao depósito), o comprimento da rota de cada formiga e, para cada aresta, o feromônio anterior, após a evaporação, o depósito total e o valor final.
10. O botão **Executar testes** roda os testes da seção 6 na própria página. O botão **Modo noturno** alterna o tema e não afeta os cálculos.

## Parâmetros

| Campo | Valor inicial | Validação |
| --- | --- | --- |
| Vértices | cenário de 8 vértices | identificador único e não vazio; x e y entre 0 e 1.000, com até duas casas decimais; sem coordenadas repetidas; de 4 a 12 vértices |
| Depósito | A | um dos vértices cadastrados |
| Número de formigas | 10 | inteiro entre 1 e 100 |
| Número de iterações | 30 | inteiro entre 1 e 200 |
| Influência do feromônio (α) | 1 | número entre 0 e 5 |
| Influência da distância (β) | 2 | número entre 0 e 5 |
| Taxa de evaporação (ρ) | 50% | percentual entre 0% e 90%, convertido em fração na fórmula |
| Feromônio inicial (τ₀) | 1 | número entre 0,01 e 100 |
| Constante de depósito (Q) | 14 | número entre 0,01 e 10.000 |
| Semente aleatória | 42 | inteiro |

## Bibliotecas auxiliares

Nenhuma biblioteca externa é utilizada. O algoritmo, o grafo (SVG), o gráfico (`<canvas>`) e a interface foram implementados no próprio projeto. O gerador pseudoaleatório com semente é o algoritmo público *mulberry32*, escrito diretamente em `aco.js` e usado em todos os sorteios.

## Resultados dos testes (seção 6)

Os testes estão em `testes.js` e chamam as mesmas funções usadas pelo simulador. Nos testes controlados, as rotas e as escolhas são fornecidas diretamente às funções. Resultados decimais comparados com tolerância absoluta de 0,000001.

### 6.1 Instância de referência e cálculo das rotas

- **Entrada:** A = (0,0), B = (3,0), C = (3,4), D = (0,4); depósito A.
- **Distâncias obtidas:** A-B = 3; A-C = 5; A-D = 4; B-C = 4; B-D = 5; C-D = 3. A matriz é simétrica e d(i, i) = 0.

| Rota | Comprimento obtido | Referência |
| --- | --- | --- |
| A → B → C → D → A | 14 | 14 |
| A → B → D → C → A | 16 | 16 |
| A → C → B → D → A | 18 | 18 |
| A → C → D → B → A | 16 | 16 |
| A → D → B → C → A | 18 | 18 |
| A → D → C → B → A | 14 | 14 |

A função de validação de rotas rejeita rota incompleta, com vértice repetido, sem retorno ao depósito ou que não parte do depósito.

**Conclusão:** distâncias e comprimentos iguais à referência; o ótimo é 14.

### 6.2 Probabilidades de escolha

- **Em A, nenhum outro vértice visitado, τ = 1, α = 1, β = 2:** w(A,B) = 0,111111 (1/9); w(A,C) = 0,04 (1/25); w(A,D) = 0,0625 (1/16). Probabilidades: p(A,B) = 0,520156; p(A,C) = 0,187256; p(A,D) = 0,292588; soma 1.
- **Sorteio proporcional:** em 100.000 sorteios com essas probabilidades, as frequências foram B = 0,5189; C = 0,1872; D = 0,2939. Os três candidatos são escolhidos; nenhum é excluído por não ter o maior peso.
- **Após a visita a B:** p(B,C) = 0,609756 (25/41) e p(B,D) = 0,390244 (16/41). A e B não participam do sorteio.
- **α = 0 e β = 0, com feromônios diferentes nas arestas (7; 0,2; 1):** p = 0,333333 para os três candidatos.
- **Um único candidato:** probabilidade 1.

**Conclusão:** valores iguais à referência.

### 6.3 Evaporação e depósito

- **Entrada:** τ₀ = 1, ρ = 50%, Q = 14, uma formiga, rota forçada A → B → C → D → A (L = 14).
- **Após a evaporação:** as seis arestas com 0,5.
- **Log de AB:** anterior 1; após evaporação 0,5; depósito 1; final 1,5.
- **Log de AC:** anterior 1; após evaporação 0,5; depósito 0; final 0,5.

| Situação | Perímetro (AB, BC, CD, AD) | Diagonais (AC, BD) | Referência |
| --- | --- | --- | --- |
| 1ª iteração, uma formiga | 1,5 | 0,5 | 1,5 e 0,5 |
| 2ª iteração, mesma rota | 1,75 | 0,25 | 1,75 e 0,25 |
| Reinício, duas formigas na mesma rota, uma iteração | 2,5 | 0,5 | 2,5 e 0,5 |
| ρ = 0%, uma formiga, uma iteração | 2 | 1 | sem redução por evaporação |

A aresta de retorno D → A recebe o depósito Q/L = 1, a matriz permanece simétrica e a diagonal fica sem feromônio.

**Conclusão:** valores iguais à referência. O caso de duas formigas confirma que os depósitos são somados e aplicados só depois que todas as rotas estão completas. Com ρ = 0%, a evaporação não reduz o feromônio.

### 6.4 Execução completa e reprodutibilidade

- **Parâmetros:** instância da seção 6.1; depósito A; 10 formigas; 30 iterações; α = 1; β = 2; ρ = 50%; τ₀ = 1; Q = 14; semente 42.
- **Estado inicial (iteração 0):** τ = 1 em todas as arestas, sem rota calculada; a melhor distância aparece como "ainda não calculada".
- **Saída obtida:** melhor rota A → D → C → B → A; comprimento 14; encontrada na iteração 1.
- Iteração 1: menor 14, média 14,8. Iteração 30: menor 14, média 14.
- Feromônio final: AB = BC = CD = AD = 20; AC = BD ≈ 3,58 × 10⁻⁷.
- **Verificações:**
  - o histórico tem 30 registros, um por iteração concluída;
  - as 300 rotas construídas são válidas e medem 14, 16 ou 18;
  - a melhor distância acumulada nunca aumenta;
  - repetir dados, parâmetros e semente reproduz o mesmo histórico e os mesmos feromônios;
  - avançar iteração por iteração produz o mesmo histórico da execução contínua;
  - na interface, executar, pausar na iteração 5 e retomar produziu a mesma tabela de histórico de uma execução direta, com intervalos visuais diferentes.

**Conclusão:** a execução atingiu o ótimo de referência (14), em uma das duas orientações da rota ótima. Ao final, todo o feromônio está concentrado no perímetro e as diagonais estão praticamente sem feromônio, de modo que as dez formigas percorrem a rota ótima.

### 6.5 Efeito dos parâmetros e entradas inválidas

Comparação de β, mantendo os demais parâmetros da seção 6.4; cinco execuções por configuração.

| Semente | β = 0: melhor distância | β = 0: média das formigas na iteração 30 | β = 2: melhor distância | β = 2: média das formigas na iteração 30 |
| --- | --- | --- | --- | --- |
| 1 | 14 (iteração 1) | 15,2 | 14 (iteração 1) | 14 |
| 2 | 14 (iteração 1) | 15,4 | 14 (iteração 1) | 14 |
| 3 | 14 (iteração 1) | 16,2 | 14 (iteração 1) | 14 |
| 4 | 14 (iteração 1) | 15,2 | 14 (iteração 1) | 14 |
| 5 | 14 (iteração 1) | 15,8 | 14 (iteração 1) | 14 |

| Configuração | Média da melhor distância final | Execuções que atingiram 14 |
| --- | --- | --- |
| β = 0 | 14 | 5 de 5 |
| β = 2 | 14 | 5 de 5 |

**Interpretação.** Na melhor distância final não houve diferença: as dez execuções atingiram 14 já na primeira iteração. A instância tem apenas seis rotas possíveis, duas delas ótimas, e cada iteração sorteia dez rotas; mesmo escolhendo ao acaso, é muito provável que alguma formiga encontre o ótimo logo no início. Portanto, estes dados não mostram vantagem de β = 2 sobre β = 0 na qualidade da melhor rota.

A diferença aparece no comportamento da colônia. Com β = 2, a distância orienta as escolhas desde o início, o feromônio se concentra no perímetro e, na iteração 30, todas as formigas percorrem a rota ótima (média 14; a média ao longo das 30 iterações ficou entre 14,1 e 14,5). Com β = 0, a escolha depende só do feromônio, que parte uniforme; a média das formigas ficou em torno de 16 ao longo da execução (16 é a média dos seis comprimentos possíveis) e ainda estava entre 15,2 e 16,2 na iteração 30, ou seja, a colônia não havia convergido. Em instâncias maiores, em que encontrar o ótimo por acaso é improvável, essa diferença de convergência tende a se refletir também na melhor distância.

**Entradas inválidas.** Cada caso abaixo impede a execução e gera mensagem; conferido na função de validação e na interface.

| Entrada | Mensagem |
| --- | --- |
| Coordenadas duplicadas | "Coordenadas duplicadas: os vértices C e D estão em (3; 4), o que daria distância zero." |
| Identificadores repetidos | "Identificador repetido: "A" aparece nos vértices nº 1 e nº 4." |
| Menos de quatro vértices | "Cadastre entre 4 e 12 vértices (há 3)." |
| Coordenada vazia | "Vértice A: a coordenada x está vazia." |
| Coordenada fora do intervalo | "Vértice A: a coordenada x deve estar entre 0 e 1.000, com até duas casas decimais." |
| Número de formigas vazio | "Número de formigas: o campo está vazio." |
| 0 ou 101 formigas | "Número de formigas: informe um inteiro entre 1 e 100." |
| 201 iterações | "Número de iterações: informe um inteiro entre 1 e 200." |
| α = 5,1 | "Influência do feromônio (α): informe um número entre 0 e 5." |
| β = −1 | "Influência da distância (β): informe um número entre 0 e 5." |
| ρ = 91% | "Taxa de evaporação (ρ): informe um número entre 0 e 90%." |
| τ₀ = 0 | "Feromônio inicial (τ₀): informe um número entre 0,01 e 100." |
| Q = 10.001 | "Constante de depósito (Q): informe um número entre 0,01 e 10.000." |
| Semente não inteira | "Semente aleatória: informe um número inteiro." |

Na interface, o botão de remover fica desabilitado quando há quatro vértices, e o de adicionar, quando há doze.

**ρ = 0%:** no teste 6.3 com ρ = 0%, o valor após a evaporação é igual ao anterior em todas as arestas; só os depósitos alteram o feromônio.

**Conclusão:** as entradas inválidas são bloqueadas com mensagens claras, e o efeito de β foi interpretado conforme o resultado obtido.

### Como reproduzir

- Na página: botão **Executar testes**.
- No terminal: `node rodar-testes.js` (requer Node.js; termina com código 0 se todos os testes passarem).
