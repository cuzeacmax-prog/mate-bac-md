import { generateEmbedding, generateEmbeddingForQuery, EMBEDDING_DIMENSIONS } from '../../src/lib/embeddings/gemini';

async function main() {
  console.log(`🧪 Test embedding — dimensiune așteptată: ${EMBEDDING_DIMENSIONS}`);

  const docEmb = await generateEmbedding('Triunghi dreptunghic cu catetele 3 și 4');
  console.log(`📄 RETRIEVAL_DOCUMENT: ${docEmb.length} dimensiuni — ${docEmb.length === EMBEDDING_DIMENSIONS ? '✅ OK' : '❌ DIMENSIUNE GREȘITĂ'}`);

  const qEmb = await generateEmbeddingForQuery('calculează ipotenuza');
  console.log(`🔍 RETRIEVAL_QUERY:    ${qEmb.length} dimensiuni — ${qEmb.length === EMBEDDING_DIMENSIONS ? '✅ OK' : '❌ DIMENSIUNE GREȘITĂ'}`);

  const dot = docEmb.slice(0, 5).map((v, i) => v * qEmb[i]).reduce((a, b) => a + b, 0);
  console.log(`🔗 Dot product (primele 5 dim): ${dot.toFixed(6)}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
