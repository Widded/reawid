import assert from 'node:assert/strict';
import {
  prepareBookContext,
  askBookAi,
  assessOcrCoverage,
  buildParagraphMetadataIndex,
  multiStageBookRetrieval,
  verifyAnswerClaims,
  retrieveRelevantPages,
  extractEvidenceParagraphs
} from '../src/services/aiService.js';

console.log('================================================================');
console.log('ReaWid — Gelişmiş Çok Aşamalı Kitap RAG & Kanıt Doğrulama Test Paketi');
console.log('Hedef: 10 Kategori x 10 Senaryo = 100 Kapsamlı Senaryo Testi');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(categoryNum, scenarioNum, title, testFn) {
  totalTests++;
  const label = `[K${categoryNum}-S${scenarioNum}] ${title}`;
  try {
    testFn();
    console.log(`  [PASS] ${label}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${label}`);
    console.error(`     HATA: ${err.message}`);
    failedTests++;
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Ortak Zengin Mock Kitap Verisi
// -------------------------------------------------------------
const mockBookPages = {
  1: 'BÖLÜM 1: Dursley Ailesi ve Gizemli Bebek\nMr ve Mrs Dursley, Privet Drive 4 numarada otururlardı. Gayet normal olduklarını söylemekten gurur duyarlardı. Dumbledore gece sokağa geldi ve minik Harry Potter\'ı kapı eşiğine bıraktı.',
  2: 'Harry on bir yaşına basana kadar merdiven altındaki karanlık dolapta yaşadı. Dursley\'ler onun büyücü olduğunu saklamak için her şeyi yaptılar.',
  3: 'BÖLÜM 2: Diagon Yolu ve Gringotts\nHagrid, Harry\'yi Londra\'ya götürdü. Çatlak Kazan\'dan geçip Diagon Yolu\'na ulaştılar. Gringotts büyücü bankasında Hagrid 713 numaralı gizli kasadan üzeri kahverengi kağıtla sarılı küçük esrarengiz bir paketi aldı.',
  4: 'Hagrid Harry\'ye doğum günü hediyesi olarak beyaz bir kar baykuşu olan Hedwig\'i satın aldı. Ollivander\'ın dükkanından 11 inçlik anka kuşu tüyü içeren asasını aldı.',
  5: 'BÖLÜM 3: Hogwarts Ekspresi ve Yeni Dostlar\nPlatform 9 3/4\'ten kalkan trende Harry, Ron Weasley ile aynı kompartımana oturdu. Birlikte çikolatalı kurbağa ve her lezzetten fasulyeler yediler. Hermione Granger kompartımana girip Neville\'in kurbağasını sordu.',
  6: 'Trende Draco Malfoy, Crabbe ve Goyle ile geldi. Harry\'ye dostluk teklif etti ama Harry doğru kişilerle kendisinin arkadaş olacağını söyleyerek Malfoy\'un elini sıkmadı.',
  7: 'BÖLÜM 7: Seçmen Şapka ve Açılış Ziyafeti\nBüyük Salon\'da Seçmen Şapka şarkısını söyledi. Şapka Harry\'nin başına konduğunda Slytherin\'de büyük olabileceğini fısıldadı ama Harry "Slytherin olmasın" diye düşündü. Şapka yüksek sesle "GRYFFINDOR!" diye bağırdı. Ziyafet sırasında Harry öğretmenler masasına baktı. Siyah yağlı saçlı Profesör Snape ile göz göze geldiği o anda, alnındaki şimşek biçimli yara izinde ani ve keskin bir acı hissetti. O esnada mor sarıklı Profesör Quirrell da Snape ile konuşuyordu.',
  8: 'BÖLÜM 8: İksir Dersi ve Şüpheler\nProfesör Snape iksir dersinde Harry\'ye çirişotu ve pelinotu karışımından ne elde edileceğini sordu. Harry bilmediğini söyledi. Harry, Snape\'in kendisinden nefret ettiğini düşünmeye başladı.',
  9: 'BÖLÜM 9: Gece Yarısı Düellosu ve Fluffy\nHarry, Ron, Hermione ve Neville üçüncü kattaki yasak koridora girdiler. Orada devasa üç başlı bir canavar köpeğin (Fluffy) bir kapağın üzerinde uyuduğunu gördüler. Canavar bir şeyi koruyordu.',
  10: 'Cadılar Bayramı akşamında Profesör Quirrell Büyük Salon\'a koşarak "Zindanlarda bir ifrit var!" diye bağırdı ve bayıldı. Harry ve Ron kızlar tuvaletine koşup Hermione\'yi dev ifritten kurtardılar.',
  11: 'BÖLÜM 11: İlk Quidditch Maçı\nHarry Gryffindor Arayıcısı olarak sahaya çıktı. Maç sırasında Harry\'nin Nimbus 2000 süpürgesi aniden kontrolden çıktı ve sarsılmaya başladı. Hermione tribünde Snape\'in gözlerini Harry\'den ayırmadan bir şeyler mırıldandığını gördü. Hermione gizlice koşup Snape\'in cüppesini ateşe verdi. Süpürge düzeldi ve Harry Altın Snitch\'i ağzıyla yakaladı.',
  12: 'Harry Cadılar Bayramı gecesi Snape\'in bacağının sarılı olduğunu ve üç başlı köpeğin onu ısırdığını fark etti. Harry ve Ron, Snape\'in Fluffy\'nin koruduğu nesneyi çalmaya çalıştığından şüphelendiler.',
  13: 'BÖLÜM 13: Nicolas Flamel ve Felsefe Taşı\nHarry çikolatalı kurbağa kartından Nicolas Flamel adını hatırladı. Flamel\'in Felsefe Taşı\'nın tek üreticisi olduğunu ve bu taşın sonsuz yaşam iksiri sağladığını öğrendiler.',
  14: 'Hagrid bir yabancıdan ejderha yumurtası kazandı ve bir Norveç Pütürlüsü (Norbert) yumurtadan çıktı. Ejderha büyüyünce Charlie\'nin arkadaşlarına Romanya\'ya gönderme planı yaptılar. Malfoy bu planı duydu.',
  15: 'Yasak Orman cezasında Harry ölü tekboynuzun kanını içen pelerinli karanlık bir siluet gördü. Kentaur Firenze Harry\'yi kurtardı ve o pelerinlinin Voldemort olduğunu söyledi.',
  16: 'BÖLÜM 16: Kapağın Altındaki Tuzaklar\nDumbledore Bakanlık\'a çağrılınca Harry, Ron ve Hermione kapağın altına indiler. Şeytan Kapanı\'nı aştılar, kanatlı uçan anahtarı yakaladılar, Ron dev büyücü satrancında kendini feda ederek oyunu kazandı. Hermione Snape\'in hazırladığı ateşli iksir bilmecesini mantıkla çözdü.',
  17: 'BÖLÜM 17: İki Yüzlü Adam ve Aynadaki Gerçek\nHarry son odaya girdiğinde karşısında Snape\'i değil, sarıklı Profesör Quirrell\'ı buldu! Quirrell güldü: "Evet, Snape tam şüphelenilecek bir tiptir değil mi? Quidditch maçında süpürgeni lanetleyen bendim; zavallı Snape ise seni kurtarmak için karşı büyü yapıyordu! Cadılar Bayramı\'nda ifriti içeri ben saldım, Snape beni durdurmak için 3. kata gitti ve Fluffy bacağını ısırdı!" Quirrell sarığını çıkardı ve kafasının arkasında Lord Voldemort\'un korkunç yüzü belirdi. Aynaya bakan Harry\'nin cebinde birden Felsefe Taşı belirdi çünkü Dumbledore taşı sadece onu kullanmak değil bulmak isteyenin alabileceği şekilde büyülemişti. Quirrell Harry\'ye dokunduğunda elleri alev alıp yandı çünkü Lily\'nin sevgisi Harry\'yi koruyordu.',
  // Ek sayfalar: Diğer edebi eserler ve test metinleri
  21: 'Suç ve Ceza - Bölüm 1: Raskolnikov sıcak bir temmuz akşamı odasından çıktı ve K. Köprüsü yönünde yürüdü. Tefeci kocakarı Alyona Ivanovna\'nın evine gitti. Cebindeki rehin saati uzattı.',
  22: 'Raskolnikov kapıcı odasından gizlice bir balta çaldı. Tefeci kadının evine çıktı ve baltayı kadının başına indirdi. O sırada içeri giren masum üvey kız kardeş Lizaveta\'yı da öldürmek zorunda kaldı.',
  23: 'Raskolnikov çaldığı paraları ve rehin eşyalarını V. Caddesi\'ndeki kimsesiz bir avluda bulunan ağır bir taşın altına gömdü. Tek bir kopek bile harcamadı.',
  24: 'Meyhanede tanıştığı eski memur Marmeladov, sarhoş bir halde caddeden geçerken bir at arabasının tekerlekleri altında kalarak ezildi ve öldü.',
  25: 'Sorgu yargıcı Porfiri Petroviç, Raskolnikov ile görüşmesinde onun yazdığı "Suç Üzerine" makalesini tartıştı. Porfiri, cinayeti boyacı Mikolka\'nın sahte itirafına rağmen Raskolnikov\'un işlediğini psikolojik olarak biliyordu.',
  31: '1984 - Bölüm 1: Soğuk ve aydınlık bir nisan günüydü, saatler on üçü vuruyordu. Winston Smith Zafer Konutları\'ndaki dairesine girdi. Duvarlarda "BÜYÜK BİRADERİN GÖZÜ ÜSTÜNDE" afişleri asılıydı.',
  32: 'Winston tele-ekranın görüş açısı dışındaki köşeye çekilerek gizlice aldığı günlüğü açtı ve titreyen ellerle "KAHROLSUN BÜYÜK BİRADER" diye yazdı. Bu bir düşünce suçuydu.',
  33: 'O\'Brien Winston\'a gizemli bir bakış fırlattı. Winston onun İç Parti üyesi olmasına rağmen Kardeşlik yeraltı direnişine mensup olduğunu düşündü.',
  34: 'Winston ve Julia antika dükkanı sahibi Bay Charrington\'ın odasında buluşurlardı. Fakat Charrington aslında Düşünce Polisi\'nin gizli bir ajanıydı ve onları tuzağa düşürdü.',
  35: 'Sevgi Bakanlığı\'nda O\'Brien Winston\'ı bizzat sorguladı ve işkence yaptı. O\'Brien, Emmanuel Goldstein\'ın kitabını aslında Parti\'nin kurguladığını itiraf etti.'
};

// =============================================================
// KATEGORİ 1: GERÇEK KİTAP OLAYLARI (10 Senaryo)
// =============================================================
console.log('--- Kategori 1: Gerçek Kitap Olayları (Doğrulanmış Kanıt Tespiti) ---');

runTest(1, 1, 'Harry Gryffindor binasına seçildi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter Seçmen Şapka tarafından hangi binaya seçildi?'
  });
  assert.ok(res.evidenceSufficiency.isSufficient, 'Kanıt yeterli olmalı');
  const found = res.allEvidence.some(e => e.text.includes('GRYFFINDOR') && e.pageNumber === 7);
  assert.ok(found, 'Sayfa 7 Gryffindor kanıtı bulunmalı');
});

runTest(1, 2, 'Hogwarts Ekspresi ve Ron ile tanışma', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry trende kiminle tanıştı ve ne yediler?'
  });
  assert.ok(res.allEvidence.some(e => e.text.includes('Ron Weasley') && e.text.includes('çikolatalı kurbağa')));
});

runTest(1, 3, 'Gringotts 713 nolu kasa ve Hagrid', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Gringotts kasasında Hagrid 713 numaradan ne aldı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 3 && e.text.includes('713')));
});

runTest(1, 4, 'Raskolnikov tefeci kadını balta ile öldürdü', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Raskolnikov tefeci kadını hangi aletle öldürdü?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 22 && e.text.includes('balta')));
});

runTest(1, 5, 'Marmeladov at arabasının altında kalarak öldü', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Marmeladov nasıl ve nerede can verdi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 24 && e.text.includes('at arabası')));
});

runTest(1, 6, 'Winston Smith günlüğe Kahrolsun Büyük Birader yazdı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Winston günlüğüne hangi düşünce suçunu yazdı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 32 && e.text.includes('KAHROLSUN BÜYÜK BİRADER')));
});

runTest(1, 7, 'Nicolas Flamel ve Felsefe Taşı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Nicolas Flamel neyin tek üreticisidir?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 13 && e.text.includes('Felsefe Taşı')));
});

runTest(1, 8, 'Hagrid Norbert adında ejderha yumurtasından ejderha çıkardı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hagrid\'in kazandığı ejderhanın türü ve adı nedir?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 14 && e.text.includes('Norbert')));
});

runTest(1, 9, 'Fluffy üç başlı canavar köpek', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Üçüncü kattaki kapağı bekleyen canavar neydi?'
  });
  assert.ok(res.allEvidence.some(e => e.text.includes('üç başlı') || e.text.includes('Fluffy')));
});

runTest(1, 10, 'Charrington antika dükkanı sahibi ve Düşünce Polisi ajanı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Bay Charrington aslında kimin ajanı çıktı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 34 && e.text.includes('Düşünce Polisi')));
});

// =============================================================
// KATEGORİ 2: YANLIŞ ÖNCÜLLÜ SORULAR (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 2: Yanlış Öncüllü Sorular (Öncülü Çürüten Kanıt Tespiti) ---');

runTest(2, 1, 'Yanlış Öncül: Ron Slytherin seçildi mi?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Ron Weasley neden Slytherin binasına seçildiğinde sevinçten ağladı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 7 || e.pageNumber === 5));
});

runTest(2, 2, 'Yanlış Öncül: Raskolnikov tefeciyi tabancayla mı vurdu?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Raskolnikov tefeci kadını tabancayla vururken kurşun nereye isabet etti?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 22 && e.text.includes('balta')), 'Balta kanıtı öncülü çürütmeli');
});

runTest(2, 3, 'Yanlış Öncül: Dumbledore Harry\'yi okuldan attı mı?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Dumbledore 1. sınıfta Harry\'yi neden okuldan atmakla tehdit etti?'
  });
  assert.ok(res.evidenceSufficiency.confidenceScore < 0.6 || res.counterEvidence.length > 0 || !res.evidenceSufficiency.isSufficient);
});

runTest(2, 4, 'Yanlış Öncül: Winston Büyük Birader\'i öldürdü mü?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Winston Smith Büyük Birader\'i hangi suikast silahıyla öldürdü?'
  });
  assert.ok(res.counterEvidence.length > 0 || res.evidenceSufficiency.missingReasons.length > 0);
});

runTest(2, 5, 'Yanlış Öncül: Harry Draco ile trende el sıkıştı mı?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry neden trende Malfoy ile hemen el sıkışıp dost oldu?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 6 && e.text.includes('elini sıkmadı')));
});

runTest(2, 6, 'Yanlış Öncül: Raskolnikov çaldığı altınları gazinoda mı harcadı?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Raskolnikov çaldığı paraları hangi eğlence mekanında harcadı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 23 && e.text.includes('taşın altına gömdü')));
});

runTest(2, 7, 'Yanlış Öncül: Hagrid Harry\'ye hediye olarak ejderha mı verdi?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hagrid Harry\'nin 11. yaş gününde ona hediye olarak hangi ejderhayı aldı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 4 && e.text.includes('Hedwig')));
});

runTest(2, 8, 'Yanlış Öncül: Felsefe Taşı\'nı çalmak için ifriti Snape mi saldı?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Snape Cadılar Bayramı gecesi ifriti neden kasıtlı olarak saldı?'
  });
  assert.ok(res.counterEvidence.some(e => e.pageNumber === 17 && e.text.includes('Quirrell')) || res.allEvidence.some(e => e.pageNumber === 17));
});

runTest(2, 9, 'Yanlış Öncül: Porfiri Petroviç cinayeti Mikolka\'nın işlediğine kesin inandı mı?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Porfiri Petroviç boyacı Mikolka itiraf edince davayı neden hemen kapattı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 25 && e.text.includes('Raskolnikov')));
});

runTest(2, 10, 'Yanlış Öncül: O\'Brien Goldstein\'ın kitabını Winston\'a gizlice yardım etmek için mi verdi?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'O\'Brien Winston\'a Goldstein\'ın kitabını vererek Parti\'yi devirmesini nasıl sağladı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 35 && e.text.includes('Parti')));
});

// =============================================================
// KATEGORİ 3: KİTAPTA BULUNMAYAN BİLGİLER (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 3: Kitapta Bulunmayan Bilgiler (Kanıt Yetersizliği & Reddi) ---');

runTest(3, 1, 'Hogwarts\'ta iPhone kullanımı sorulduğunda kanıt yetersiz olmalı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter Hogwarts kütüphanesinde hangi iPhone modelini kullandı?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 2, 'Raskolnikov ve lüks spor araba', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Raskolnikov tefeciden sonra hangi marka arabaya bindi?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 3, 'Winston Smith ve Bitcoin yatırımı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Winston 1984 yılında hangi kripto para birimine yatırım yaptı?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 4, 'Hogwarts ziyafetinde McDonalds hamburgerleri', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hogwarts açılış ziyafetinde hangi fast food hamburgerleri servis edildi?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 5, 'Dumbledore\'un uzay mekiği roketi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Dumbledore uzaya fırlatmak için hangi roketi inşa etti?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 6, 'Voldemort ve lazer ışını tabancası', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Voldemort Felsefe Taşı odasında hangi lazer silahını ateşledi?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 7, 'Hermione\'nin dizüstü bilgisayarı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hermione kütüphanede hangi dizüstü bilgisayarı ve Wi-Fi ağını kullandı?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 8, 'Privet Drive\'da uçan daire inişi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Dursley ailesinin bahçesine inen uzaylılar kimlerdi?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 9, 'Porfiri Petroviç\'in DNA parmak izi laboratuvarı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Porfiri Petroviç baltadaki parmak izi ve DNA testini hangi laboratuvarda yaptırdı?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(3, 10, 'Bağlam çıktısında [KANIT YETERSİZLİĞİ BİLDİRİMİ] yer almalı', () => {
  const ctx = prepareBookContext({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter hangi model Tesla elektrikli arabayı kullandı?'
  });
  assert.ok(ctx.includes('[KANIT YETERSİZLİĞİ BİLDİRİMİ]'), 'Yetersizlik bildirimi bağlama eklenmeli');
});

// =============================================================
// KATEGORİ 4: FAN TEORİLERİ VE UYDURMA MEKANİZMALAR (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 4: Fan Teorileri ve Uydurma Büyüsel Mekanizmalar ---');

runTest(4, 1, 'Snape\'in Legilimency gücünün yarayı yaktığı iddiası uydurmadır', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Snape\'in Legilimency yeteneği Harry\'nin yara izini nasıl yakıyor?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 || e.pageNumber === 7));
  const verification = verifyAnswerClaims({
    answer: 'Snape\'in zihinbende yeteneği ve gözlerindeki karanlık enerji Harry\'nin yarasını yakmaktadır.',
    evidenceParagraphs: res.allEvidence,
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });
  assert.ok(verification.unverifiedClaims.length > 0 || verification.hasSuspiciousClaims);
});

runTest(4, 2, 'Snape\'in gözlerinin Voldemort enerjisi ilettiği iddiası tespiti', () => {
  const verification = verifyAnswerClaims({
    answer: 'Snape\'in gözleri Voldemort\'un karanlık enerjisini Harry\'ye iletmektedir.',
    evidenceParagraphs: [{ text: 'Harry alnındaki yara izinde ani bir acı hissetti. Quirrell da Snape ile konuşuyordu.' }],
    bookTitle: 'Harry Potter ve Felsefe Taşı'
  });
  assert.ok(verification.hasSuspiciousClaims || verification.unverifiedClaims.length > 0);
});

runTest(4, 3, 'Ron Weasley aslında zamanda seyahat eden Dumbledore mudur?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Ron Weasley\'nin aslında zamanda yolculuk yapan Dumbledore olduğu nasıl açıklanır?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(4, 4, 'Hogwarts aslında bir akıl hastanesi hayali midir?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter\'ın aslında komada bir akıl hastası olduğu iddiası kitapta nerede geçer?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(4, 5, 'Yara izi iki karanlık büyünün çarpışması mıdır?', () => {
  const verification = verifyAnswerClaims({
    answer: 'Yara izi iki karanlık büyünün çarpışması sonucu sürekli sızlamaktadır.',
    evidenceParagraphs: [{ text: 'Alnındaki şimşek biçimli yara izinde ani ve keskin bir acı hissetti.' }]
  });
  assert.ok(verification.unverifiedClaims.length > 0 || verification.hasSuspiciousClaims);
});

runTest(4, 6, 'Draco Malfoy kurt adam teorisi kitapta yok', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Draco Malfoy\'un bir kurt adam tarafından ısırıldığı kitapta nasıl geçer?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(4, 7, 'Dumbledore\'un Harry\'yi bilerek istismar ettirdiği teorisi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Dumbledore Harry\'nin Dursley ailesi tarafından eziyet görmesini bilerek mi planladı?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(4, 8, 'Neville Longbottom gerçek seçilmiş kişi miydi?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Neville\'in aslında tek gerçek kehanet çocuğu olduğu 1. kitapta nerede yazıyor?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(4, 9, 'Crookshanks Lily Potter\'ın kedisi mi?', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hermione\'nin kedisi Crookshanks\'ın Lily Potter\'ın eski kedisi olduğu nerede yazmaktadır?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

runTest(4, 10, 'Raskolnikov Napolyon reenkarnasyonu teorisi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Raskolnikov kendisinin Napolyon\'un ruhunun bedene girmiş hali olduğunu mu iddia ediyor?'
  });
  assert.equal(res.evidenceSufficiency.isSufficient, false);
});

// =============================================================
// KATEGORİ 5: FİLM VE KİTAP FARKLILIKLARI (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 5: Film ve Kitap Farklılıkları ---');

runTest(5, 1, 'Harry\'nin göz rengi kitapta zümrüt yeşilidir', () => {
  const testPages = {
    ...mockBookPages,
    2: 'Harry annesi Lily gibi parlak zümrüt yeşili göz rengine sahipti. Merdiven altındaki dolapta yaşardı.'
  };
  const res = multiStageBookRetrieval({
    pagesTextMap: testPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter\'ın göz rengi kitapta ne renktir?'
  });
  assert.ok(res.allEvidence.some(e => e.text.includes('yeşili')));
});

runTest(5, 2, 'Peeves poltergeist şatoda aktiftir (filmde çıkarıldı)', () => {
  const testPages = {
    ...mockBookPages,
    7: 'Büyük Salon\'da poltergeist Peeves öğrencilerin kafasına tebeşir fırlatıyordu. Seçmen Şapka Gryffindor dedi.'
  };
  const res = multiStageBookRetrieval({
    pagesTextMap: testPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hogwarts\'taki poltergeist Peeves ne yaptı?'
  });
  assert.ok(res.allEvidence.some(e => e.text.includes('Peeves')));
});

runTest(5, 3, 'Snape\'in iksir bilmecesi 1. kitapta vardır (filmde kesildi)', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hermione Felsefe Taşı yolunda hangi iksir bilmecesini çözdü?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 16 && e.text.includes('iksir bilmecesi')));
});

runTest(5, 4, 'Quirrell sarığını çıkarınca Voldemort kafasının arkasında çıkar', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Quirrell sarığını çıkardığında ne görüldü?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('Voldemort')));
});

runTest(5, 5, 'Dumbledore taşı sadece kullanmak istemeyenin alacağını belirlemiştir', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Aynadaki Felsefe Taşı büyüsünü Dumbledore nasıl kurgulamıştır?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('bulmak isteyen')));
});

runTest(5, 6, 'Norbert Romanya\'ya Charlie\'nin arkadaşlarına gönderildi (filmde Hagrid\'den hemen alındı)', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Ejderha Norbert kime ve nereye gönderildi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 14 && e.text.includes('Romanya')));
});

runTest(5, 7, 'Kentaur Firenze Harry\'yi kurtardı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Yasak Orman\'da tekboynuz kanı içen pelerinliden Harry\'yi kim kurtardı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 15 && e.text.includes('Firenze')));
});

runTest(5, 8, 'Ron satranç oyununda kendini feda etti', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Dev satranç oyununu kazanmak için Ron ne yaptı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 16 && e.text.includes('feda')));
});

runTest(5, 9, 'Harry Snitch\'i ağzıyla yakaladı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry ilk maçında Altın Snitch\'i nasıl yakaladı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 11 && e.text.includes('ağzıyla')));
});

runTest(5, 10, 'Ollivander\'ın dükkanından asanın özellikleri', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry\'nin asası kaç inç ve hangi tüyü içeriyordu?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 4 && e.text.includes('anka kuşu')));
});

// =============================================================
// KATEGORİ 6: İLERİKİ BÖLÜMLERDE AÇIKLANAN SIRLAR (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 6: İleriki Bölümlerde Açıklanan Sırlar ---');

runTest(6, 1, 'Taşın peşindeki gerçek hainin Quirrell olduğunun ortaya çıkması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Felsefe Taşı\'nın peşindeki kişi gerçekte kimdir?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('Quirrell')));
});

runTest(6, 2, 'Quidditch maçında süpürgeyi Quirrell\'in lanetlemesi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Quidditch maçında süpürgeyi kim lanetledi ve Snape ne yapıyordu?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('karşı büyü')));
});

runTest(6, 3, 'Cadılar Bayramı\'nda ifriti içeri salanın Quirrell olması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Hogwarts\'a ifriti salan kişi kimdi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('ifriti içeri ben saldım')));
});

runTest(6, 4, 'Snape\'in bacağının Fluffy tarafından Quirrell\'i durdururken ısırılması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Snape\'in bacağını Fluffy neden ısırdı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('beni durdurmak için')));
});

runTest(6, 5, 'Raskolnikov\'un çaldığı eşyaları taşın altına saklaması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Raskolnikov çaldığı eşyaları nereye gizledi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 23 && e.text.includes('taşın altına')));
});

runTest(6, 6, 'Bay Charrington\'ın Düşünce Polisi tuzağı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Winston ve Julia\'yı tuzağa düşüren Charrington\'ın gerçek görevi neydi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 34 && e.text.includes('Düşünce Polisi')));
});

runTest(6, 7, 'Goldstein\'ın kitabının Parti tarafından kurgulandığı gerçeği', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Emmanuel Goldstein\'ın kitabını gerçekte kim hazırlamıştı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 35 && e.text.includes('Parti\'nin kurguladığını')));
});

runTest(6, 8, 'Felsefe Taşı\'nın Harry\'nin cebine nasıl girdiği', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Felsefe Taşı Harry\'nin cebinde nasıl belirdi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('cebinde')));
});

runTest(6, 9, 'Lily\'nin sevgisinin Quirrell\'ı yakması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Quirrell\'a dokununca neden Quirrell yandı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('sevgisi')));
});

runTest(6, 10, 'Porfiri Petroviç\'in cinayeti Raskolnikov\'un işlediğini bilmesi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Porfiri Petroviç cinayeti kimin işlediğini düşünüyordu?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 25 && e.text.includes('Raskolnikov')));
});

// =============================================================
// KATEGORİ 7: KARŞIT KANITLAR VE YANILTMACALAR (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 7: Karşıt Kanıtlar ve Yanıltmacalar (Red-Herring Resolution) ---');

runTest(7, 1, 'Harry Snape\'ten şüphelenirken suçlunun Quirrell olması karşıt kanıtı', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry neden Snape\'in Felsefe Taşı\'nı çalmak istediğini düşündü?'
  });
  assert.ok(res.counterEvidence.length > 0 || res.allEvidence.some(e => e.pageNumber === 17));
  const hasQuirrell = res.allEvidence.some(e => e.text.includes('Quirrell'));
  assert.ok(hasQuirrell, 'Quirrell kanonik gerçeği karşıt/tamamlayıcı kanıtta bulunmalı');
});

runTest(7, 2, 'Yara izinin sızlaması: Snape şüphesi vs arkasındaki Quirrell gerçeği', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry açılış yemeğinde Snape\'e bakarken yara izi neden acıdı?'
  });
  const pages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(pages.includes(7), 'Sayfa 7 (açılış sahnesi) bulunmalı');
  assert.ok(pages.includes(17), 'Sayfa 17 (Quirrell gerçeği) karşıt kanıt olarak bulunmalı');
});

runTest(7, 3, 'Süpürgenin sarsılması: Hermione\'nin Snape\'i ateşe vermesi vs Quirrell laneti', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Quidditch maçında Harry\'nin süpürgesini Snape mi sarstı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 11), 'Sayfa 11 maç sahnesi');
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17), 'Sayfa 17 Quirrell itirafı');
});

runTest(7, 4, 'Snape\'in bacağındaki ısırık: Hırsızlık vs Quirrell\'i durdurma', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Snape üçüncü kata taşı çalmak için mi gitti?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('beni durdurmak')));
});

runTest(7, 5, 'Porfiri ve Mikolka itirafı: Yanıltıcı itiraf vs asıl katil', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 30,
    spoilerProtection: false,
    question: 'Boyacı Mikolka suçu üstlenince cinayeti o mu işlemiş oldu?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 25 && e.text.includes('sahte itiraf')));
});

runTest(7, 6, 'Winston O\'Brien\'ı kurtarıcı sanırken baş cellat olması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'O\'Brien direnişin gizli lideri midir yoksa cellat mı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 33) && res.allEvidence.some(e => e.pageNumber === 35));
});

runTest(7, 7, 'Charrington masum antikacı vs Düşünce Polisi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 35,
    spoilerProtection: false,
    question: 'Charrington güvenilir bir antikacı mıdır?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 34 && e.text.includes('Düşünce Polisi')));
});

runTest(7, 8, 'Hagrid ifriti Quirrell\'in saldığını bilmezken salınması', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Zindandaki ifriti kim içeri bıraktı?'
  });
  assert.ok(res.allEvidence.some(e => e.text.includes('Quirrell')));
});

runTest(7, 9, 'Malfoy dostluk önerdiğinde Harry\'nin reddetmesi', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Malfoy\'a güvendi mi?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 6 && e.text.includes('elini sıkmadı')));
});

runTest(7, 10, 'Aynada taşı arayan Quirrell vs taşı bulan Harry', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Quirrell aynada taşı neden bulamadı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 17 && e.text.includes('kullanmak')));
});

// =============================================================
// KATEGORİ 8: EKSİK OCR KAPSAM DURUMU (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 8: Eksik OCR Kapsam Durumu (Coverage Awareness) ---');

runTest(8, 1, 'assessOcrCoverage: 100 sayfalık kitapta sadece 10 sayfa taranmışsa %10 vermeli', () => {
  const scanned = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f', 7: 'g', 8: 'h', 9: 'i', 10: 'j' };
  const cov = assessOcrCoverage({ totalPages: 100, scannedPagesMap: scanned });
  assert.equal(cov.totalPages, 100);
  assert.equal(cov.scannedPagesCount, 10);
  assert.equal(cov.unscannedPagesCount, 90);
  assert.equal(cov.coveragePercent, 10);
  assert.equal(cov.isComplete, false);
});

runTest(8, 2, 'assessOcrCoverage: Yalnızca min/max sayfa taranmışsa aradaki boşlukları tespit etmeli', () => {
  const scanned = { 1: 'Başlangıç', 300: 'Son' };
  const cov = assessOcrCoverage({ totalPages: 300, scannedPagesMap: scanned });
  assert.equal(cov.scannedPagesCount, 2);
  assert.equal(cov.unscannedPagesCount, 298);
  assert.equal(cov.isComplete, false);
});

runTest(8, 3, 'assessOcrCoverage: İşlemdeki (activePages) sayfaları listelemeli', () => {
  const scanned = { 1: 'Sayfa 1' };
  const active = new Set([2, 3]);
  const cov = assessOcrCoverage({ totalPages: 10, scannedPagesMap: scanned, activePages: active });
  assert.deepEqual(cov.inProgressPages, [2, 3]);
});

runTest(8, 4, 'assessOcrCoverage: Başarısız (failedPages) sayfaları listelemeli', () => {
  const scanned = { 1: 'Sayfa 1' };
  const failed = new Map([[4, 'OCR Hatası']]);
  const cov = assessOcrCoverage({ totalPages: 10, scannedPagesMap: scanned, failedPages: failed });
  assert.deepEqual(cov.failedPages, [4]);
});

runTest(8, 5, 'assessOcrCoverage: Tüm sayfalar taranmışsa %100 ve isComplete: true olmalı', () => {
  const scanned = { 1: 'a', 2: 'b', 3: 'c' };
  const cov = assessOcrCoverage({ totalPages: 3, scannedPagesMap: scanned });
  assert.equal(cov.coveragePercent, 100);
  assert.equal(cov.isComplete, true);
  assert.equal(cov.unscannedPagesCount, 0);
});

runTest(8, 6, 'prepareBookContext: Taranmamış sayfa uyarısını bağlama eklemeli', () => {
  const scanned = { 1: 'Harry Hogwarts\'a gitti.' };
  const ctx = prepareBookContext({
    pagesTextMap: scanned,
    currentPage: 1,
    spoilerProtection: false,
    question: 'Harry Voldemort ile nerede savaştı?',
    totalPages: 300
  });
  assert.ok(ctx.includes('[OCR KAPSAMA VE TARAMA DURUMU]'), 'OCR Kapsama başlığı olmalı');
  assert.ok(ctx.includes('Henüz Taranmamış Sayfalar: 299 sayfa'), 'Eksik sayfa uyarısı bulunmalı');
});

runTest(8, 7, 'assessOcrCoverage: Boş sayfa haritasında sıfır bölme hatası vermemeli', () => {
  const cov = assessOcrCoverage({ totalPages: 0, scannedPagesMap: {} });
  assert.equal(cov.coveragePercent, 0);
  assert.equal(cov.totalPages, 0);
});

runTest(8, 8, 'assessOcrCoverage: Sayfa metni boşluk veya boş string ise taranmamış sayılmalı', () => {
  const scanned = { 1: 'Dolu metin', 2: '   \n  ', 3: '' };
  const cov = assessOcrCoverage({ totalPages: 3, scannedPagesMap: scanned });
  assert.equal(cov.scannedPagesCount, 1);
  assert.equal(cov.unscannedPagesCount, 2);
});

runTest(8, 9, 'Taranmamış sayfalardan dolayı kanıt yetersiz olduğunda fallback uyarısı bulunmalı', () => {
  const scanned = { 1: 'Dursley ailesi Privet Drive\'da otururdu.' };
  const ctx = prepareBookContext({
    pagesTextMap: scanned,
    currentPage: 1,
    spoilerProtection: false,
    question: 'Quirrell sarığını çıkarınca ne oldu?',
    totalPages: 200
  });
  assert.ok(ctx.includes('UYARI: Kitabın henüz 199 sayfası taranmamıştır'));
});

runTest(8, 10, 'Tüm kitap taranmışsa bağlamda eksik sayfa uyarısı olmamalı', () => {
  const scanned = { 1: 'Sayfa bir', 2: 'Sayfa iki' };
  const ctx = prepareBookContext({
    pagesTextMap: scanned,
    currentPage: 2,
    spoilerProtection: false,
    totalPages: 2
  });
  assert.ok(!ctx.includes('Henüz Taranmamış Sayfalar'));
});

// =============================================================
// KATEGORİ 9: SPOILER KORUMASI SINIRLARI (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 9: Spoiler Koruması Sınırları (Strict Page Boundaries) ---');

runTest(9, 1, 'Sayfa 5\'teyken Sayfa 17\'deki Quirrell sürprizi kesinlikle getirilmemeli', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 5,
    spoilerProtection: true,
    question: 'Felsefe Taşı\'nı çalmaya çalışan kişi kimdir?'
  });
  const maxPage = Math.max(...res.allEvidence.map(e => e.pageNumber), 0);
  assert.ok(maxPage <= 5, `Hiçbir kanıt Sayfa 5\'ten büyük olamaz. Bulunan en büyük sayfa: ${maxPage}`);
});

runTest(9, 2, 'Sayfa 7\'deyken Quidditch maçı (Sayfa 11) getirilmemeli', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 7,
    spoilerProtection: true,
    question: 'Quidditch maçında süpürgeye ne oldu?'
  });
  const pages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(!pages.includes(11), 'Sayfa 11 spoiler olmalı');
});

runTest(9, 3, 'Sayfa 10\'dayken Fluffy ve ısırık (Sayfa 12) getirilmemeli', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 10,
    spoilerProtection: true,
    question: 'Snape\'in bacağını hangi canavar ısırdı?'
  });
  const pages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(!pages.includes(12), 'Sayfa 12 spoiler olmalı');
});

runTest(9, 4, 'Spoiler koruması KAPALIYKEN Sayfa 17 getirilmelidir', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 5,
    spoilerProtection: false,
    question: 'Felsefe Taşı odasındaki sarıklı adam kimdir?'
  });
  const pages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(pages.includes(17), 'Spoiler kapalıyken sayfa 17 gelebilmeli');
});

runTest(9, 5, 'Raskolnikov: Sayfa 21\'deyken (balta cinayeti Sayfa 22) getirilmemeli', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 21,
    spoilerProtection: true,
    question: 'Tefeci kadının başına ne geldi?'
  });
  const pages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(!pages.includes(22), 'Sayfa 22 cinayet spoiler olmalı');
});

runTest(9, 6, '1984: Sayfa 32\'deyken Charrington\'ın polis ajanı olduğu (Sayfa 34) getirilmemeli', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 32,
    spoilerProtection: true,
    question: 'Bay Charrington güvenilir biri midir?'
  });
  const pages = res.allEvidence.map(e => e.pageNumber);
  assert.ok(!pages.includes(34), 'Sayfa 34 polis ajanı spoiler olmalı');
});

runTest(9, 7, 'İkinci aşama genişletme (Stage 2) spoiler sınırını aşamaz', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 3,
    spoilerProtection: true,
    question: 'Büyük Salon açılış ziyafetinde şapka ne söyledi?'
  });
  for (const ev of res.allEvidence) {
    assert.ok(ev.pageNumber <= 3, `Stage 2 genişletmesi Sayfa 3\'ü aşamaz. Geldi: ${ev.pageNumber}`);
  }
});

runTest(9, 8, 'Karşıt kanıt aşaması (Stage 3) spoiler sınırını aşamaz', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 8,
    spoilerProtection: true,
    question: 'Snape neden Harry\'den nefret ediyor ve taşı mı çalacak?'
  });
  for (const ev of res.counterEvidence) {
    assert.ok(ev.pageNumber <= 8, `Stage 3 karşıt kanıt Sayfa 8\'i aşamaz. Geldi: ${ev.pageNumber}`);
  }
});

runTest(9, 9, 'prepareBookContext spoiler koruması açıkken ileriki sayfaları bağlama eklemez', () => {
  const ctx = prepareBookContext({
    pagesTextMap: mockBookPages,
    currentPage: 2,
    spoilerProtection: true,
    question: 'Harry Hogwarts\'a nasıl gitti?'
  });
  assert.ok(!ctx.includes('[Sayfa 3]'));
  assert.ok(!ctx.includes('[Sayfa 7]'));
});

runTest(9, 10, 'Kitabın son sayfasındayken tüm taranmış sayfalar aranabilir', () => {
  const res = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 17,
    spoilerProtection: true,
    question: 'Privet Drive\'da Harry\'yi kim kapıya bıraktı?'
  });
  assert.ok(res.allEvidence.some(e => e.pageNumber === 1));
});

// =============================================================
// KATEGORİ 10: İDDİA DOĞRULAMA VE SAHTE ALINTI ENGELLEME (10 Senaryo)
// =============================================================
console.log('\n--- Kategori 10: İddia Doğrulama ve Sahte Alıntı Engelleme (Claim Verification) ---');

runTest(10, 1, 'verifyAnswerClaims: Sahte tırnak içi alıntıyı yakalamalı', () => {
  const answer = 'J.K. Rowling kitapta şöyle demiştir: "Snape\'in gözleri karanlık lordun büyüsel frekansını taşıyordu."';
  const evidence = [{ text: 'Harry alnındaki yara izinde ani bir acı hissetti.' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.equal(v.fakeQuotes.length, 1);
  assert.equal(v.verifiedQuotes.length, 0);
  assert.ok(v.flaggedText.includes('[UYARI:'));
});

runTest(10, 2, 'verifyAnswerClaims: Orijinal metinde birebir olan tırnak içi alıntıyı onaylamalı', () => {
  const answer = 'Seçmen şapka son anda "GRYFFINDOR!" diye bağırmıştır.';
  const evidence = [{ text: 'Şapka yüksek sesle "GRYFFINDOR!" diye bağırdı.' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.equal(v.fakeQuotes.length, 0);
  assert.equal(v.verifiedQuotes.length, 1);
});

runTest(10, 3, 'verifyAnswerClaims: Olmayan uydurma bölüm iddiasını yakalamalı', () => {
  const answer = 'Bu olay 42. Bölümde detaylıca açıklanmaktadır.';
  const evidence = [{ text: 'BÖLÜM 7: Seçmen Şapka' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.ok(v.unverifiedClaims.some(c => c.includes('42')));
});

runTest(10, 4, 'verifyAnswerClaims: Uydurma sayfa numarası iddiasını yakalamalı', () => {
  const answer = 'Bu bilgi Sayfa 950 üzerinde açıkça geçmektedir.';
  const evidence = [{ pageNumber: 7, text: 'Ziyafet sırasında...' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.ok(v.unverifiedClaims.some(c => c.includes('950')));
});

runTest(10, 5, 'verifyAnswerClaims: Kanıtsız büyüsel mekanizma (Legilimency yara yakar) iddiasını işaretlemeli', () => {
  const answer = 'Snape\'in zihinokuma ve legilimency yeteneği Harry\'nin yarasını yakmaktadır.';
  const evidence = [{ text: 'Harry alnındaki yara izinde ani ve keskin bir acı hissetti.' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.ok(v.hasSuspiciousClaims || v.unverifiedClaims.length > 0);
});

runTest(10, 6, 'verifyAnswerClaims: Boş yanıt veya salt selamlama geldiğinde çökmemeli', () => {
  const v = verifyAnswerClaims({ answer: '   ', evidenceParagraphs: [] });
  assert.equal(v.fakeQuotes.length, 0);
  assert.equal(v.unverifiedClaims.length, 0);
});

runTest(10, 7, 'buildParagraphMetadataIndex: bookId, pageNumber ve paragraphIndex üretmeli', () => {
  const idx = buildParagraphMetadataIndex({
    pagesTextMap: {
      1: 'İlk paragraf metni.\n\nİkinci paragraf metni.'
    },
    bookId: 'hp1'
  });
  assert.equal(idx.length, 2);
  assert.equal(idx[0].bookId, 'hp1');
  assert.equal(idx[0].pageNumber, 1);
  assert.equal(idx[0].paragraphIndex, 1);
  assert.equal(idx[1].paragraphIndex, 2);
  assert.equal(idx[0].ocrStatus, 'completed');
});

runTest(10, 8, 'multiStageBookRetrieval: Tekrarlayan aynı aramada önbellekten (LRU) hızlı dönmeli', () => {
  const t0 = performance.now();
  const res1 = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter Seçmen Şapka tarafından hangi binaya seçildi?'
  });
  const t1 = performance.now();
  const res2 = multiStageBookRetrieval({
    pagesTextMap: mockBookPages,
    currentPage: 18,
    spoilerProtection: false,
    question: 'Harry Potter Seçmen Şapka tarafından hangi binaya seçildi?'
  });
  const t2 = performance.now();
  assert.equal(res1.allEvidence.length, res2.allEvidence.length);
  assert.ok((t2 - t1) <= (t1 - t0) + 2, 'İkinci sorgu önbellekten gelmeli');
});

runTest(10, 9, 'Tırnak içinde uydurma olmayan Türkçe ifadeleri doğru ayırt etmeli', () => {
  const answer = 'Şapka Harry\'ye "Slytherin olmasın" düşüncesini duyduğunu söyledi.';
  const evidence = [{ text: 'Harry "Slytherin olmasın" diye düşündü.' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.equal(v.fakeQuotes.length, 0);
  assert.equal(v.verifiedQuotes.length, 1);
});

runTest(10, 10, 'verifyAnswerClaims: Bayraklandırma sonucunu temiz metin olarak döndürmeli', () => {
  const answer = 'Rowling şöyle demiştir: "Snape aslında Harry\'nin gizli koruyucusuydu."';
  const evidence = [{ text: 'Farklı bir metin.' }];
  const v = verifyAnswerClaims({ answer, evidenceParagraphs: evidence });
  assert.ok(v.flaggedText.length >= answer.length);
  assert.ok(v.flaggedText.includes('Doğrulanamayan Alıntı/İddia'));
});

// =============================================================
// TEST RAPORU ÖZETİ
// =============================================================
console.log('\n================================================================');
console.log(`TEST RAPORU: ${passedTests} / ${totalTests} Senaryo Başarılı (%${Math.round((passedTests / totalTests) * 100)})`);
if (failedTests > 0) {
  console.log(`HATA SAYISI: ${failedTests}`);
} else {
  console.log('TÜM 100 SENARYO KUSURSUZ ŞEKİLDE GEÇTİ!');
}
console.log('================================================================');
