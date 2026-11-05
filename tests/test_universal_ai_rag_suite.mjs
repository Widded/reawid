import assert from 'node:assert/strict';
import {
  understandBookQuestion,
  multiStageBookRetrieval,
  prepareBookContext,
  getTurkishStem,
  matchesTurkishWord
} from '../src/services/aiService.js';

console.log('================================================================');
console.log('REAWID — GENEL VE EVRENSEL KİTAP RAG & AI DOĞRULAMA TEST PAKETİ');
console.log('Amac: Kitaba özel istisna/hardcode olmadan her kitapta kanıta dayalı RAG');
console.log('================================================================\n');

let passedTests = 0;
const totalTests = 7;

// ============================================================================
// SENARYO 1: Harry Potter — Hogwarts kabul mektubunu öğrenme (Doğal Dil & Anlamsal)
// ============================================================================
console.log('--- SENARYO 1: Harry Potter — Kabul Mektubu ve Anlamsal Eşleşme ---');
{
  const hpPages = {
    24: 'Hagrid siyah paltosunun cebinden hafifçe ezilmiş bir kutu çıkardı. İçinde yeşil kremayla Mutlu Yıllar Harry yazan çikolatalı bir pasta vardı. Dev "Ben Rubeus Hagrid, Hogwarts\'ta Anahtarların ve Toprakların Bekçisiyim" dedi.',
    26: 'Vernon Dursley "Dur, çocuğa bir şey söylemeni yasaklıyorum!" diye bağırdı. Hagrid öfkeyle baktı: "Harry, sen bir büyücüsün. Şimdi mektubunu okuma vakti." Harry sarımsı zarfı açtı: HOGWARTS CADILIK VE BÜYÜCÜLÜK OKULU. Sayın Mr Potter, Hogwarts Cadılık ve Büyücülük Okulu\'nda yerinizin ayrılmış olduğunu size bildirmekten mutluluk duymaktayız. Baykuşunuzu 31 Temmuz\'dan önce göndermenizi dileriz. Sevgilerimizle, Minerva McGonagall Müdür Yardımcısı.',
    27: 'Hagrid bir baykuş çıkardı, küçük bir parşömene "Harry\'nin mektubu verildi, yarın onu alacaklarını almaya götürüyorum" yazıp Dumbledore\'a yolladı.'
  };

  const question = "Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter'
  });

  const res = multiStageBookRetrieval({
    pagesTextMap: hpPages,
    currentPage: 27,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'hp_1'
  });

  console.log('  Retrieval Durumu:', res.evidenceSufficiency.status, `(Skor: ${res.evidenceSufficiency.score})`);
  const topEvidence = res.allEvidence[0];
  console.log('  Bulunan En Güçlü Kanıt:', `Sayfa ${topEvidence?.pageNumber} - "${topEvidence?.text.slice(0, 100)}..."`);

  assert.equal(res.evidenceSufficiency.isSufficient, true, 'Senaryo 1: Kanıt yeterli bulunmalı');
  assert.equal(topEvidence?.pageNumber, 26, 'Senaryo 1: Sayfa 26 en güçlü kanıt olmalı');
  assert.ok(topEvidence?.text.includes('yerinizin ayrılmış olduğunu'), 'Senaryo 1: Kabul metni bulunmalı');

  const context = prepareBookContext({
    pagesTextMap: hpPages,
    currentPage: 27,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'hp_1',
    totalPages: 170
  });

  assert.ok(!context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'Senaryo 1: Haksız ret bildirimi olmamalı');
  assert.ok(context.includes('[KANIT DEĞERLENDİRME VE ANLAMSAL CEVAPLAMA TALİMATI]'), 'Senaryo 1: Anlamsal değerlendirme talimatı bulunmalı');
  console.log('  [PASS] Senaryo 1 Başarılı!\n');
  passedTests++;
}

// ============================================================================
// SENARYO 2: Harry Potter — İlgili Sayfalar Taranmamışsa Eksik OCR Tespiti
// ============================================================================
console.log('--- SENARYO 2: İlgili Sayfalar Taranmamışsa Eksik OCR Durumu ---');
{
  // Yalnızca 1-10. sayfalar taranmış, 25-27 henüz taranmamış
  const partialPages = {
    1: 'Mr ve Mrs Dursley Privet Drive 4 numarada otururlardı. Gayet normal olduklarını söylerlerdi.',
    2: 'Dumbledore gece Privet Drive sokağına geldi ve bebeği kapı eşiğine bıraktı.',
    5: 'Harry on bir yaşına kadar merdiven altındaki dolapta yaşadı.'
  };

  const question = "Harry Hogwarts'a kabul edildiğini nasıl öğreniyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Harry Potter'
  });

  const res = multiStageBookRetrieval({
    pagesTextMap: partialPages,
    currentPage: 5,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'hp_part'
  });

  console.log('  Mevcut Taranan Sayfalarda Durum:', res.evidenceSufficiency.status);
  assert.equal(res.evidenceSufficiency.isSufficient, false, 'Senaryo 2: Henüz taranmamış sayfalar için kanıt yetersiz olmalı');

  const context = prepareBookContext({
    pagesTextMap: partialPages,
    currentPage: 5,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'hp_part',
    totalPages: 170
  });

  // Bağlamda eksik sayfaların olduğu ve taranmamış bölümler uyarısı yer almalı
  assert.ok(context.includes('[OCR KAPSAMA VE TARAMA DURUMU]'), 'Senaryo 2: Kapsama raporu bağlamda olmalı');
  assert.ok(context.includes('Henüz Taranmamış Sayfalar'), 'Senaryo 2: Taranmamış sayfa uyarısı olmalı');
  assert.ok(context.includes('UYARI: Kitabın henüz'), 'Senaryo 2: Taranmamış bölümler olduğunu açıkça bildirmeli');
  console.log('  [PASS] Senaryo 2 Başarılı!\n');
  passedTests++;
}

// ============================================================================
// SENARYO 3: Başka Bir Roman — Statik Listede Olmayan Karakter (Kürk Mantolu Madonna)
// ============================================================================
console.log('--- SENARYO 3: Başka Bir Roman & Dinamik Karakterler (Kürk Mantolu Madonna) ---');
{
  const kmmPages = {
    10: 'Ankara\'da bir bankada çevirmen olarak çalışmaya başladım. Yan masamda sessiz sedasız oturan Raif Efendi dikkatimi çekti.',
    12: 'Raif Efendi gençliğinde babası tarafından sabunculuk öğrenmesi için Berlin\'e gönderilmişti. Bir gün Berlin resim sergisinde kürk mantolu bir kadın portresinin önünde dakikalarca büyülendi. Tablonun adı Kürk Mantolu Madonna idi. Raif portreye hayranlıkla bakarken ressam Maria Puder sessizce yanına yaklaştı.',
    13: 'Maria Puder ile Raif Efendi sergi salonunun çıkışındaki küçük kafede ilk kez oturdular ve sanat üzerine konuştular. Maria "Beni o tabloda gördüğünüz gibi tanıyın" dedi.'
  };

  // "Raif Efendi" ve "Maria Puder" eski statik KNOWN_ENTITIES listesinde ASLA yoktu
  const question = "Raif Efendi Maria Puder ile ilk kez nerede karşılaştı?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Kürk Mantolu Madonna'
  });

  const res = multiStageBookRetrieval({
    pagesTextMap: kmmPages,
    currentPage: 15,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'kmm_1'
  });

  console.log('  Retrieval Durumu:', res.evidenceSufficiency.status, `(Skor: ${res.evidenceSufficiency.score})`);
  const topEvidence = res.allEvidence[0];
  console.log('  Bulunan Kanıt:', `Sayfa ${topEvidence?.pageNumber} - "${topEvidence?.text.slice(0, 110)}..."`);

  assert.equal(res.evidenceSufficiency.isSufficient, true, 'Senaryo 3: Statik listede olmayan karakter reddedilmemeli');
  const foundPages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(foundPages.includes(12) || foundPages.includes(13), 'Senaryo 3: Sergi salonu veya kafe karşılaşması (Sayfa 12/13) bulunmalı');
  assert.ok(res.allEvidence.some(e => e.text.includes('Maria Puder')), 'Senaryo 3: Maria Puder kanıt metni içermeli');
  console.log('  [PASS] Senaryo 3 Başarılı!\n');
  passedTests++;
}

// ============================================================================
// SENARYO 4: Anlamsal Eşdeğerlik — Birebir Kelime Eşleşmesi Olmadan Anlam Tespiti (Dönüşüm)
// ============================================================================
console.log('--- SENARYO 4: Anlamsal Eşdeğerlik (Dönüşüm — Franz Kafka) ---');
{
  const donusumPages = {
    1: 'Gregor Samsa bir sabah bunaltıcı düşlerden uyandığında kendini yatağında devasa bir böceğe dönüşmüş olarak buldu. Zırh gibi sertleşmiş sırtının üstünde yatıyordu, başını azıcık kaldırınca sayısız bacağının çaresizce titreştiğini gördü.',
    2: 'Saat sabahın yedisi olmuştu. Çalar saat çalıyordu ama Gregor yataktan kalkamıyordu.',
    3: 'Kapı çalındı. Annesi "Gregor, saat yediye çeyrek var, işe gitmeyecek misin?" diye seslendi.'
  };

  // Sorudaki "fiziksel başkalaşım" ve "haşere" kelimeleri metinde birebir geçmez (metin: "devasa bir böceğe dönüşmüş", "zırh gibi sırt", "sayısız bacak")
  const question = "Gregor'un fiziksel olarak bir haşereye başkalaşım geçirdiği nasıl anlaşılıyor?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Dönüşüm'
  });

  const res = multiStageBookRetrieval({
    pagesTextMap: donusumPages,
    currentPage: 3,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'donusum_1'
  });

  console.log('  Retrieval Durumu:', res.evidenceSufficiency.status, `(Skor: ${res.evidenceSufficiency.score})`);
  const topEvidence = res.allEvidence[0];
  console.log('  Bulunan Kanıt:', `Sayfa ${topEvidence?.pageNumber} - "${topEvidence?.text.slice(0, 100)}..."`);

  assert.equal(res.evidenceSufficiency.isSufficient, true, 'Senaryo 4: Anlamsal eşdeğerlik yeterli kabul edilmeli');
  assert.equal(topEvidence?.pageNumber, 1, 'Senaryo 4: Sayfa 1 kanıt olarak getirilmeli');
  assert.ok(topEvidence?.text.includes('böceğe dönüşmüş'), 'Senaryo 4: Dönüşüm pasajı bulunmalı');
  console.log('  [PASS] Senaryo 4 Başarılı!\n');
  passedTests++;
}

// ============================================================================
// SENARYO 5: Kanıtsız Soru — Kitapta Karşılığı Olmayan Soruda Red & Uydurma Engeli (1984)
// ============================================================================
console.log('--- SENARYO 5: Kanıtsız Soru & Uydurma Engeli (1984 — George Orwell) ---');
{
  const orwellPages = {
    1: 'Hava soğuk ve rüzgarlıydı, saatler on üçü vuruyordu. Winston Smith daire kapısından içeri süzüldü.',
    2: 'Holdeki tele-ekrandan maden üretimiyle ilgili istatistikler okunuyordu. Büyük Birader\'in devasa posteri duvardaydı: BÜYÜK BİRADER SENİ İZLİYOR.',
    3: 'Winston gizlice satın aldığı günlüğü açtı ve titreyen ellerle yazmaya başladı: KAHROLSUN BÜYÜK BİRADER.'
  };

  const question = "Winston Smith Parti toplantısına katılmak için hangi marka elektrikli arabayı kullandı?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: '1984'
  });

  const res = multiStageBookRetrieval({
    pagesTextMap: orwellPages,
    currentPage: 3,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: '1984_1'
  });

  console.log('  Retrieval Durumu:', res.evidenceSufficiency.status, `(isSufficient: ${res.evidenceSufficiency.isSufficient})`);
  console.log('  Eksiklik Gerekçesi:', res.evidenceSufficiency.missingReasons.join('; '));

  assert.equal(res.evidenceSufficiency.isSufficient, false, 'Senaryo 5: Kanıt yetersiz olmalı');

  const context = prepareBookContext({
    pagesTextMap: orwellPages,
    currentPage: 3,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: '1984_1',
    totalPages: 350
  });

  assert.ok(context.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'Senaryo 5: Ret talimatı bağlama eklenmeli');
  assert.ok(context.includes('Bu bilgiyi kitabın taranmış metninde doğrulayamadım.'), 'Senaryo 5: Zorunlu ret cümlesi bulunmalı');
  console.log('  [PASS] Senaryo 5 Başarılı!\n');
  passedTests++;
}

// ============================================================================
// SENARYO 6: Spoiler Koruması AÇIK — İleriki Sayfalar Kesinlikle Engellenmeli (Suç ve Ceza)
// ============================================================================
console.log('--- SENARYO 6: Spoiler Koruması AÇIK (Sayfa 4\'te Cinayet Sorusu) ---');
{
  const scPages = {
    2: 'Raskolnikov Petersburg sokaklarında bunaltıcı temmuz sıcağında yürüyordu. Çatı katındaki küçük odasına dönmek istemiyordu.',
    4: 'Meyhanede eski memur Marmeladov ile karşılaştı. Marmeladov ailesinin yoksulluğunu ve kızı Sonya\'nın fedakarlığını anlattı.',
    22: 'Raskolnikov tefeci kadının dairesine girdi. Paltosunun altındaki baltayı çıkararak kadının başına indirdi. Tefeci kadın cansız yere yığıldı.'
  };

  const question = "Raskolnikov tefeci kadını nasıl öldürdü?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Suç ve Ceza'
  });

  // Kullanıcı henüz Sayfa 4'te ve spoiler koruması AÇIK
  const res = multiStageBookRetrieval({
    pagesTextMap: scPages,
    currentPage: 4,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'sc_1'
  });

  console.log('  Retrieval Durumu (Sayfa 4 sınırı):', res.evidenceSufficiency.status);
  const anyFuturePage = res.allEvidence.some(e => e.pageNumber > 4);
  console.log('  İleriki sayfa (Sayfa 22) sızdı mı?', anyFuturePage);

  assert.equal(anyFuturePage, false, 'Senaryo 6: Sayfa 4 ötesindeki cinayet sahnesi asla getirilmemeli');
  assert.equal(res.evidenceSufficiency.isSufficient, false, 'Senaryo 6: Henüz okunmayan kısım için kanıt yetersiz kalmalı');

  const context = prepareBookContext({
    pagesTextMap: scPages,
    currentPage: 4,
    spoilerProtection: true,
    question,
    semanticAnalysis: semantic,
    bookId: 'sc_1',
    totalPages: 600
  });

  assert.ok(!context.includes('[Sayfa 22]'), 'Senaryo 6: Sayfa 22 bağlama kesinlikle girmemeli');
  assert.ok(!context.includes('baltayı çıkararak'), 'Senaryo 6: Cinayet detayı bağlama sızmamalı');
  console.log('  [PASS] Senaryo 6 Başarılı!\n');
  passedTests++;
}

// ============================================================================
// SENARYO 7: Spoiler Koruması KAPALI — İleriki Sayfalar Serbestçe Aranabilmeli (Suç ve Ceza)
// ============================================================================
console.log('--- SENARYO 7: Spoiler Koruması KAPALI (Sayfa 4\'teyken Tüm Kitap Serbest) ---');
{
  const scPages = {
    2: 'Raskolnikov Petersburg sokaklarında bunaltıcı temmuz sıcağında yürüyordu. Çatı katındaki küçük odasına dönmek istemiyordu.',
    4: 'Meyhanede eski memur Marmeladov ile karşılaştı. Marmeladov ailesinin yoksulluğunu ve kızı Sonya\'nın fedakarlığını anlattı.',
    22: 'Raskolnikov tefeci kadının dairesine girdi. Paltosunun altındaki baltayı çıkararak kadının başına indirdi. Tefeci kadın cansız yere yığıldı.'
  };

  const question = "Raskolnikov tefeci kadını nasıl öldürdü?";
  const semantic = await understandBookQuestion({
    question,
    bookTitle: 'Suç ve Ceza'
  });

  // Kullanıcı Sayfa 4'te ama spoiler koruması KAPALI (tüm kitap aranabilir)
  const res = multiStageBookRetrieval({
    pagesTextMap: scPages,
    currentPage: 4,
    spoilerProtection: false, // KAPALI
    question,
    semanticAnalysis: semantic,
    bookId: 'sc_1'
  });

  console.log('  Retrieval Durumu (Tüm kitap serbest):', res.evidenceSufficiency.status);
  const topEvidence = res.allEvidence[0];
  console.log('  Bulunan Kanıt:', `Sayfa ${topEvidence?.pageNumber} - "${topEvidence?.text.slice(0, 100)}..."`);

  assert.equal(res.evidenceSufficiency.isSufficient, true, 'Senaryo 7: Spoiler kapalıyken kanıt yeterli olmalı');
  assert.equal(topEvidence?.pageNumber, 22, 'Senaryo 7: Sayfa 22 cinayet sahnesi bulunmalı');
  assert.ok(topEvidence?.text.includes('baltayı çıkararak'), 'Senaryo 7: Balta kanıtı yer almalı');

  const context = prepareBookContext({
    pagesTextMap: scPages,
    currentPage: 4,
    spoilerProtection: false,
    question,
    semanticAnalysis: semantic,
    bookId: 'sc_1',
    totalPages: 600
  });

  assert.ok(context.includes('Sayfa 22'), 'Senaryo 7: Sayfa 22 bağlama dahil edilmeli');
  assert.ok(context.includes('baltayı çıkararak'), 'Senaryo 7: Balta kanıtı bağlamda yer almalı');
  console.log('  [PASS] Senaryo 7 Başarılı!\n');
  passedTests++;
}

console.log('================================================================');
console.log(`SONUÇ: ${passedTests} / ${totalTests} Senaryo Kusursuz Şekilde Geçti! (%100)`);
console.log('Kitap bağımsız, anlamsal ve güvenli RAG mimarisi başarıyla doğrulandı.');
console.log('================================================================');
