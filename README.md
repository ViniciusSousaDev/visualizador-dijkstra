# ⬡ Dijkstra Visualizer

Visualizador interativo do Algoritmo de Dijkstra — construído com HTML, CSS e JavaScript puro. Pronto para deploy no Vercel.

---

## 🎮 Como usar

| Ação | Descrição |
|------|-----------|
| **⊕ Nó** | Ative e clique no canvas para adicionar nós |
| **⟶ Aresta** | Clique em dois nós consecutivos para criar aresta com peso |
| **✕ Deletar** | Clique em nó ou aresta para remover |
| **▶ Executar** | Selecione origem (e destino opcional) e execute |
| **↺ Resetar** | Limpa todo o grafo |
| **⟳ Limpar Execução** | Remove as cores do algoritmo sem apagar o grafo |

---

## 📐 Algoritmo

O algoritmo de Dijkstra encontra o caminho de menor custo em grafos ponderados com pesos não-negativos.

**Complexidade:** O((V + E) log V) usando min-heap (fila de prioridade)

```
Inicializar dist[origem] = 0, dist[demais] = ∞
Enquanto fila não vazia:
  u = nó com menor dist na fila
  Para cada vizinho v de u:
    se dist[u] + peso(u,v) < dist[v]:
      dist[v] = dist[u] + peso(u,v)
      anterior[v] = u
```

---

## 📁 Estrutura do Projeto

```
dijkstra-visualizer/
├── index.html     # Estrutura da página
├── style.css      # Tema dark + animações
├── app.js         # Algoritmo + editor de grafo em canvas
├── vercel.json    # Configuração do Vercel
└── README.md
```

---

## 💡 Tecnologias

- **HTML5 Canvas** — renderização do grafo
- **CSS Custom Properties** — sistema de temas
- **JavaScript ES2022** — lógica do algoritmo e interação
- **Min-Heap** — fila de prioridade para Dijkstra eficiente
- **Vercel** — hospedagem estática
