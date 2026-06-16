// Rankify Main Application Controller

// ==========================================
// Supabase Configuration
// ==========================================
// 회원님의 Supabase URL과 Anon Key를 입력해 주세요.
// 비어 있을 경우 자동으로 로컬 data.js의 Mock 데이터 모드로 작동합니다.
const SUPABASE_URL = 'https://fwuvrwxynplwnunzzwoh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_ffEZQoJlkNq-MuLZTDr6PA_d2Ycj6LF';

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// State
let countries = []; // Holds the active dataset (global countries, KR regions, KR apartments, or escapes)
let currentScope = 'global'; // 'global', 'korea', 'apartment', or 'escape'
let currentView = 'explore'; // 'explore', 'custom', 'community'
let selectedCategory = 'geopolitics'; // 'geopolitics', 'korean-liveability', 'climate'
let searchQuery = '';
let compareList = []; // Max 3 IDs
let weights = {
  geopolitics: 1.0,
  climate: 1.0,
  liveability: 1.0
};
let expandedDrawers = new Set();
let voteHistory = {}; // ID -> 'up' | 'down'
let previousRanks = {}; // ID -> rank integer (1-based)
let currentUser = null;
let authMode = 'login'; // 'login' | 'signup'

// Document Elements
let rankingsListEl, searchInputEl, listDescriptionEl, compareStickyBarEl, comparePillsContainerEl, compareBtnTextEl, compareGridEl;
let viewExploreLayoutEl, viewCompareLayoutEl, sidebarControlsEl, weightSlidersSectionEl, categorySidebarSectionEl;

// Initialize on DOM Load
window.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM element references
  rankingsListEl = document.getElementById('rankings-list');
  searchInputEl = document.getElementById('search-input');
  listDescriptionEl = document.getElementById('list-description-text');
  compareStickyBarEl = document.getElementById('compare-sticky-bar');
  comparePillsContainerEl = document.getElementById('compare-pills-container');
  compareBtnTextEl = document.getElementById('compare-btn-text');
  compareGridEl = document.getElementById('compare-grid');
  viewExploreLayoutEl = document.getElementById('view-explore-layout');
  viewCompareLayoutEl = document.getElementById('view-compare-layout');
  sidebarControlsEl = document.getElementById('sidebar-controls');
  weightSlidersSectionEl = document.getElementById('weight-sliders-section');
  categorySidebarSectionEl = document.getElementById('category-sidebar-section');
  
  // Load initial dataset (global scope default)
  await loadDataset('global');
  
  // Initialize apartment prices
  window.initApartmentPrices();
  
  // Render initial list
  renderRankings();
  
  // Update compare bar count
  updateCompareStickyBar();

  // Initialize authentication
  await initAuth();
});

// Load dataset according to scope (global, korea, apartment, escape)
async function loadDataset(scope) {
  currentScope = scope;
  
  // Supabase DB 연동 모드
  if (supabaseClient) {
    try {
      const dbScope = scope;
      const { data, error } = await supabaseClient
        .from('rankify_items')
        .select('*')
        .eq('category', dbScope);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        countries = data.map(item => {
          const mapped = {
            id: item.id,
            name: item.name,
            koreanName: item.korean_name,
            flag: item.flag,
            description: item.description,
            funFact: item.fun_fact,
            metrics: item.metrics,
            votes: {
              upvotes: item.upvotes,
              downvotes: item.downvotes
            }
          };
          if (item.specs) {
            Object.assign(mapped, item.specs);
          }
          return mapped;
        });
        
        // Load vote history from localStorage for local tracking
        const savedVotes = localStorage.getItem(`rankify_votes_${scope}`);
        voteHistory = savedVotes ? JSON.parse(savedVotes) : {};
        
        initializeRanks();
        return;
      }
    } catch (err) {
      console.error("Supabase 데이터 로드 실패. 로컬 Mock 데이터로 대체합니다:", err);
    }
  }
  
  // Fallback: Supabase 미설정 시 기존 Mock 데이터 로드
  if (scope === 'global') {
    countries = JSON.parse(JSON.stringify(window.RANKIFY_DATA));
    
    // Load vote history from localStorage
    const savedVotes = localStorage.getItem('rankify_votes');
    voteHistory = savedVotes ? JSON.parse(savedVotes) : {};
    
    const savedCountriesVotes = localStorage.getItem('rankify_countries_votes');
    if (savedCountriesVotes) {
      const customVotes = JSON.parse(savedCountriesVotes);
      countries.forEach(c => {
        if (customVotes[c.id]) {
          c.votes.upvotes = customVotes[c.id].upvotes;
          c.votes.downvotes = customVotes[c.id].downvotes;
        }
      });
    }
  } else if (scope === 'korea') {
    countries = JSON.parse(JSON.stringify(window.RANKIFY_REGIONS_DATA));
    
    // Load regional vote history from localStorage
    const savedVotes = localStorage.getItem('rankify_votes_regions');
    voteHistory = savedVotes ? JSON.parse(savedVotes) : {};
    
    const savedRegionsVotes = localStorage.getItem('rankify_regions_votes_data');
    if (savedRegionsVotes) {
      const customVotes = JSON.parse(savedRegionsVotes);
      countries.forEach(c => {
        if (customVotes[c.id]) {
          c.votes.upvotes = customVotes[c.id].upvotes;
          c.votes.downvotes = customVotes[c.id].downvotes;
        }
      });
    }
  } else if (scope === 'apartment') {
    countries = JSON.parse(JSON.stringify(window.RANKIFY_APARTMENTS_DATA));
    
    // Load apartment vote history from localStorage
    const savedVotes = localStorage.getItem('rankify_votes_apartments');
    voteHistory = savedVotes ? JSON.parse(savedVotes) : {};
    
    const savedApartmentsVotes = localStorage.getItem('rankify_apartments_votes_data');
    if (savedApartmentsVotes) {
      const customVotes = JSON.parse(savedApartmentsVotes);
      countries.forEach(c => {
        if (customVotes[c.id]) {
          c.votes.upvotes = customVotes[c.id].upvotes;
          c.votes.downvotes = customVotes[c.id].downvotes;
        }
      });
    }
  } else if (scope === 'escape') {
    countries = JSON.parse(JSON.stringify(window.RANKIFY_ESCAPE_DATA));
    
    // Load escape vote history from localStorage
    const savedVotes = localStorage.getItem('rankify_votes_escape');
    voteHistory = savedVotes ? JSON.parse(savedVotes) : {};
    
    const savedEscapeVotes = localStorage.getItem('rankify_escape_votes_data');
    if (savedEscapeVotes) {
      const customVotes = JSON.parse(savedEscapeVotes);
      countries.forEach(c => {
        if (customVotes[c.id]) {
          c.votes.upvotes = customVotes[c.id].upvotes;
          c.votes.downvotes = customVotes[c.id].downvotes;
        }
      });
    }
  } else { // car
    countries = JSON.parse(JSON.stringify(window.RANKIFY_CARS_DATA));
    
    // Load car vote history from localStorage
    const savedVotes = localStorage.getItem('rankify_votes_cars');
    voteHistory = savedVotes ? JSON.parse(savedVotes) : {};
    
    const savedCarVotes = localStorage.getItem('rankify_cars_votes_data');
    if (savedCarVotes) {
      const customVotes = JSON.parse(savedCarVotes);
      countries.forEach(c => {
        if (customVotes[c.id]) {
          c.votes.upvotes = customVotes[c.id].upvotes;
          c.votes.downvotes = customVotes[c.id].downvotes;
        }
      });
    }
  }

  // Pre-calculate initial ranks
  initializeRanks();
}

// Calculate and store initial ranks for comparison
function initializeRanks() {
  const sorted = sortCountries(countries, selectedCategory, currentView, weights);
  previousRanks = {};
  sorted.forEach((item, index) => {
    previousRanks[item.id] = index + 1;
  });
}

// Switch between global, korea, apartment, and escape modes
window.switchScope = async function(scope) {
  if (currentScope === scope) return;
  
  // Toggle scope button active classes
  document.getElementById('scope-global').classList.toggle('active', scope === 'global');
  document.getElementById('scope-korea').classList.toggle('active', scope === 'korea');
  document.getElementById('scope-apartment').classList.toggle('active', scope === 'apartment');
  document.getElementById('scope-escape').classList.toggle('active', scope === 'escape');
  document.getElementById('scope-car').classList.toggle('active', scope === 'car');
  
  // Reset view state
  compareList = [];
  expandedDrawers.clear();
  searchQuery = '';
  searchInputEl.value = '';
  
  // Reset weights
  resetWeights();
  
  // Load data
  await loadDataset(scope);
  
  // Update Labels in DOM
  const colHeaderName = document.getElementById('col-header-name');
  const tagGeopolitics = document.getElementById('tag-name-geopolitics');
  const tagLiveability = document.getElementById('tag-name-liveability');
  const tagClimate = document.getElementById('tag-name-climate');
  
  const sliderGeopolitics = document.getElementById('slider-label-geopolitics');
  const sliderClimate = document.getElementById('slider-label-climate');
  const sliderLiveability = document.getElementById('slider-label-liveability');

  const iconGeopolitics = document.querySelector('#cat-geopolitics i');
  const iconLiveability = document.querySelector('#cat-korean-liveability i');
  const iconClimate = document.querySelector('#cat-climate i');

  if (scope === 'global') {
    colHeaderName.textContent = '국가명';
    searchInputEl.placeholder = '국가명 또는 언어 검색...';
    
    tagGeopolitics.textContent = '지정학 & 영향력 순위';
    tagLiveability.textContent = '한국인 살기 좋은 나라';
    tagClimate.textContent = '기후 & 환경 쾌적도 순위';
    
    sliderGeopolitics.textContent = '지정학적 영향력';
    sliderClimate.textContent = '기후 쾌적성';
    sliderLiveability.textContent = '한국인 생활 인프라';

    if (iconGeopolitics) iconGeopolitics.className = 'fa-solid fa-globe';
    if (iconLiveability) iconLiveability.className = 'fa-solid fa-house-chimney-user';
    if (iconClimate) iconClimate.className = 'fa-solid fa-cloud-sun';
  } else if (scope === 'korea') {
    colHeaderName.textContent = '지역명';
    searchInputEl.placeholder = '도시 또는 도(道) 이름 검색...';
    
    tagGeopolitics.textContent = '자연재해 안전성 순위';
    tagLiveability.textContent = '생활 & 방재 인프라 순위';
    tagClimate.textContent = '기후 & 대기질 청정 순위';
    
    sliderGeopolitics.textContent = '자연재해 안전성';
    sliderClimate.textContent = '기후 & 대기 쾌적도';
    sliderLiveability.textContent = '생활 & 의료 인프라';

    if (iconGeopolitics) iconGeopolitics.className = 'fa-solid fa-shield-halved';
    if (iconLiveability) iconLiveability.className = 'fa-solid fa-city';
    if (iconClimate) iconClimate.className = 'fa-solid fa-wind';
  } else if (scope === 'apartment') {
    colHeaderName.textContent = '아파트명';
    searchInputEl.placeholder = '아파트 단지명 또는 동(洞) 이름 검색...';
    
    tagGeopolitics.textContent = '투자 가치 순위';
    tagLiveability.textContent = '실거주 편의성 순위';
    tagClimate.textContent = '자산 단가 & 네임밸류';
    
    sliderGeopolitics.textContent = '미래 투자 가치';
    sliderClimate.textContent = '실거주 편리성 (학군)';
    sliderLiveability.textContent = '단지 규모 & 네임밸류';

    if (iconGeopolitics) iconGeopolitics.className = 'fa-solid fa-arrow-trend-up';
    if (iconLiveability) iconLiveability.className = 'fa-solid fa-graduation-cap';
    if (iconClimate) iconClimate.className = 'fa-solid fa-building';
  } else if (scope === 'escape') {
    colHeaderName.textContent = '지역명';
    searchInputEl.placeholder = '피서지 명 또는 국가 이름 검색...';
    
    tagGeopolitics.textContent = '날씨 쾌적성 순위';
    tagLiveability.textContent = '체류 인프라 & 가성비';
    tagClimate.textContent = '레저 & 힐링 환경';
    
    sliderGeopolitics.textContent = '온도 및 습도 쾌적성';
    sliderClimate.textContent = '체류 물가 및 편의성';
    sliderLiveability.textContent = '자연 환경 & 액티비티';

    if (iconGeopolitics) iconGeopolitics.className = 'fa-solid fa-temperature-low';
    if (iconLiveability) iconLiveability.className = 'fa-solid fa-wallet';
    if (iconClimate) iconClimate.className = 'fa-solid fa-tree';
  } else { // car
    colHeaderName.textContent = '차량명';
    searchInputEl.placeholder = '차종, 브랜드, 엔진(전기/하이브리드/가솔린), 크기(경차/중형...) 검색...';
    
    tagGeopolitics.textContent = '경제성 & 가성비 순위';
    tagLiveability.textContent = '실용성 & 패밀리카 순위';
    tagClimate.textContent = '첨단 테크 & 성능 순위';
    
    sliderGeopolitics.textContent = '경제성 & 유지비';
    sliderClimate.textContent = '실용성 & 주행 편의';
    sliderLiveability.textContent = '테크 & 주행 성능';

    if (iconGeopolitics) iconGeopolitics.className = 'fa-solid fa-gas-pump';
    if (iconLiveability) iconLiveability.className = 'fa-solid fa-car-side';
    if (iconClimate) iconClimate.className = 'fa-solid fa-microchip';
  }
  
  // Refresh views
  updateCategoryDescription();
  renderRankings();
  updateCompareStickyBar();
  exitCompareMode();
};

// Switch main tabs (Explore, Custom weights, Community)
window.switchView = function(view) {
  currentView = view;
  
  // Toggle tab button active classes
  document.getElementById('tab-explore').classList.toggle('active', view === 'explore');
  document.getElementById('tab-custom').classList.toggle('active', view === 'custom');
  document.getElementById('tab-community').classList.toggle('active', view === 'community');
  
  // Adjust sidebar panel visibility
  if (view === 'custom') {
    weightSlidersSectionEl.style.display = 'block';
    categorySidebarSectionEl.style.display = 'none';
    if (currentScope === 'global') {
      listDescriptionEl.textContent = '가중치를 설정하여 기후, 지정학, 한국인 정착 선호도에 따른 나만의 맞춤 순위를 만듭니다.';
    } else if (currentScope === 'korea') {
      listDescriptionEl.textContent = '자연재해, 기후/대기, 생활 인프라의 가중치를 조절하여 최적의 국내 거주 지역 순위를 계산합니다.';
    } else if (currentScope === 'apartment') {
      listDescriptionEl.textContent = '1주택 보유 관점(똘똘한 한 채)에서 미래 투자 가치, 실거주 편리성, 단지 네임밸류 가중치를 설정하여 나만의 맞춤 아파트 순위를 산출합니다.';
    } else if (currentScope === 'escape') {
      listDescriptionEl.textContent = '무더운 한국의 7~8월 한여름 기간을 피해, 시원하고 보송보송한 환경에서 한 달 살기를 하기에 가장 쾌적한 피서지 순위를 산출합니다.';
    } else { // car
      listDescriptionEl.textContent = '유지비/가성비, 차량 실용성, 주행 테크 성능의 중요도를 조정하여 나에게 가장 적합한 차량 구매 순위를 실시간 계산합니다.';
    }
  } else if (view === 'community') {
    weightSlidersSectionEl.style.display = 'none';
    categorySidebarSectionEl.style.display = 'none';
    listDescriptionEl.textContent = '사용자들의 투표(추천 - 비추천)를 기반으로 실시간 결정된 집단지성 순위입니다.';
  } else { // explore
    weightSlidersSectionEl.style.display = 'none';
    categorySidebarSectionEl.style.display = 'block';
    updateCategoryDescription();
  }
  
  // Change column metric header text
  const metricColHeader = document.getElementById('col-header-metric');
  if (view === 'community') {
    metricColHeader.textContent = '추천 비율';
  } else {
    metricColHeader.textContent = '주요 지표';
  }
  
  // Reset previous ranks for transitions
  const sorted = sortCountries(countries, selectedCategory, currentView, weights);
  previousRanks = {};
  sorted.forEach((item, index) => {
    previousRanks[item.id] = index + 1;
  });

  renderRankings();
  exitCompareMode();
};

// Update description text below search
function updateCategoryDescription() {
  if (currentScope === 'global') {
    if (selectedCategory === 'geopolitics') {
      listDescriptionEl.textContent = '세계 주요 20개국의 종합 국력, 경제력(GDP), 군사력, 기술력을 기반으로 한 순위입니다.';
    } else if (selectedCategory === 'korean-liveability') {
      listDescriptionEl.textContent = '치안, 한인 마트 및 한식당 밀도, 비자 편의성, 한국어/영어 장벽 등을 합산한 살기 좋은 나라 순위입니다.';
    } else if (selectedCategory === 'climate') {
      listDescriptionEl.textContent = '연간 기온 쾌적도, 미세먼지(대기질), 습도, 지진 등 자연재해 안전성을 합산한 환경 순위입니다.';
    }
  } else if (currentScope === 'korea') {
    if (selectedCategory === 'geopolitics') {
      listDescriptionEl.textContent = '지진, 태풍, 집중호우 및 산사태 등 자연재해 빈도와 지리적 안전성을 기반으로 산출한 순위입니다.';
    } else if (selectedCategory === 'korean-liveability') {
      listDescriptionEl.textContent = '대형 의료원 밀도, 소방 방재 거점, 대중교통 인프라 및 전반적인 생활 편의성을 합산한 순위입니다.';
    } else if (selectedCategory === 'climate') {
      listDescriptionEl.textContent = '연평균 기온 쾌적성(폭염/한파 일수)과 대기 오염(초미세먼지) 청정도를 종합한 기후 환경 순위입니다.';
    }
  } else if (currentScope === 'apartment') {
    if (selectedCategory === 'geopolitics') {
      listDescriptionEl.textContent = '재건축 사업성(대지지분), 주변 개발 호재, 가격 상승 잠재력 등 투자 가치가 가장 높은 아파트 순위입니다.';
    } else if (selectedCategory === 'korean-liveability') {
      listDescriptionEl.textContent = '명문 학군, 대중교통 편리성(역세권/직주근접), 대형마트 및 상권 등 실거주 만족도가 높은 아파트 순위입니다.';
    } else if (selectedCategory === 'climate') {
      listDescriptionEl.textContent = '평당 매매단가(최고가 수준)와 건설사 하이엔드 브랜드 네임밸류, 단지 규모(커뮤니티)를 합산한 종합 아파트 순위입니다.';
    }
  } else if (currentScope === 'escape') {
    if (selectedCategory === 'geopolitics') {
      listDescriptionEl.textContent = '한국의 7월 중순~8월 말 무더위 기간 동안 기온의 선선함(온도)과 보송보송함(습도)이 우수한 피서지 날씨 순위입니다.';
    } else if (selectedCategory === 'korean-liveability') {
      listDescriptionEl.textContent = '장기 체류 시 체감 생활 물가, 치안, 교통 접근성, 숙박 및 통신 편의성 등을 합산한 인프라 가성비 순위입니다.';
    } else if (selectedCategory === 'climate') {
      listDescriptionEl.textContent = '푸른 침엽수림 산책, 수려한 알프스 하이킹, 리조트 스포츠, 호수 액티비티 등 자연 휴양에 최적화된 레저 환경 순위입니다.';
    }
  } else { // car
    if (selectedCategory === 'geopolitics') {
      listDescriptionEl.textContent = '구매 가성비(차량 가격), 유지비, 세제 혜택 등 경제성을 우선시한 가성비 차량 순위입니다.';
    } else if (selectedCategory === 'korean-liveability') {
      listDescriptionEl.textContent = '적재 공간(트렁크), 2열 레그룸, 승차 인원 및 다용도 캠핑 활용 등 패밀리카 실용성 순위입니다.';
    } else if (selectedCategory === 'climate') {
      listDescriptionEl.textContent = '자율주행 ADAS 레벨, 커넥티비티 모바일 테크, 주행 성능 및 승차감을 종합한 고성능/첨단 차량 순위입니다.';
    }
  }
}

// Select category filter
window.selectCategory = function(category) {
  selectedCategory = category;
  
  // Toggle tags active classes
  document.getElementById('cat-geopolitics').classList.toggle('active', category === 'geopolitics');
  document.getElementById('cat-korean-liveability').classList.toggle('active', category === 'korean-liveability');
  document.getElementById('cat-climate').classList.toggle('active', category === 'climate');
  
  updateCategoryDescription();
  
  // Reset previous ranks
  const sorted = sortCountries(countries, selectedCategory, currentView, weights);
  previousRanks = {};
  sorted.forEach((item, index) => {
    previousRanks[item.id] = index + 1;
  });

  renderRankings();
};

// Adjust weight slider
window.updateWeight = function(factor, val) {
  weights[factor] = parseFloat(val);
  document.getElementById(`weight-val-${factor}`).textContent = val;
  renderRankings();
};

// Reset weights
window.resetWeights = function() {
  weights = { geopolitics: 1.0, climate: 1.0, liveability: 1.0 };
  ['geopolitics', 'climate', 'liveability'].forEach(factor => {
    const slider = document.getElementById(`slider-${factor}`);
    if (slider) slider.value = 1.0;
    const valText = document.getElementById(`weight-val-${factor}`);
    if (valText) valText.textContent = '1';
  });
  renderRankings();
};

// Search trigger
window.handleSearch = function(query) {
  searchQuery = query.toLowerCase().trim();
  renderRankings();
};

// Calculators - Global Mode
function getGeopoliticalScore(c) {
  return (c.metrics.gdpScore + c.metrics.militaryScore + c.metrics.diplomaticScore + c.metrics.techScore) / 4;
}
function getClimateScore(c) {
  return (c.metrics.tempComfort + c.metrics.airQuality + c.metrics.disasterSafety + c.metrics.humidityComfort) / 4;
}
function getLiveabilityScore(c) {
  return (c.metrics.safety + c.metrics.koreanFoodDensity + c.metrics.visaEase + c.metrics.incomeVsCost + c.metrics.languageBarrier) / 5;
}

// Calculators - Korea Regional Mode
function getKRDisasterScore(r) {
  return r.metrics.disasterSafety;
}
function getKRClimateScore(r) {
  return (r.metrics.tempComfort + r.metrics.airQuality) / 2;
}
function getKRInfraScore(r) {
  return r.metrics.livingInfra;
}

// Calculators - Korea Apartment Mode
function getAptInvestmentScore(a) {
  return a.metrics.investmentValue;
}
function getAptLiveabilityScore(a) {
  return a.metrics.livingInfra;
}
function getAptPriceBrandScore(a) {
  return (a.metrics.assetValue + a.metrics.brandScale) / 2;
}

// Calculators - Summer Escape Mode
function getEscapeTempScore(e) {
  return (e.metrics.tempComfort + e.metrics.humidityComfort) / 2;
}
function getEscapeInfraScore(e) {
  return e.metrics.livingInfra;
}
function getEscapeLeisureScore(e) {
  return e.metrics.natureLeisure;
}

// Calculators - Domestic Car Mode
function getCarEconomyScore(c) {
  return c.metrics.economy;
}
function getCarUtilityScore(c) {
  return c.metrics.utility;
}
function getCarTechScore(c) {
  return (c.metrics.performance + c.metrics.tech) / 2;
}

// Weighted Score Calc
function getWeightedScore(item, w) {
  let score1, score2, score3;
  if (currentScope === 'global') {
    score1 = getGeopoliticalScore(item);
    score2 = getClimateScore(item);
    score3 = getLiveabilityScore(item);
  } else if (currentScope === 'korea') {
    score1 = getKRDisasterScore(item);
    score2 = getKRClimateScore(item);
    score3 = getKRInfraScore(item);
  } else if (currentScope === 'apartment') {
    score1 = getAptInvestmentScore(item);
    score2 = getAptLiveabilityScore(item);
    score3 = getAptPriceBrandScore(item);
  } else if (currentScope === 'escape') {
    score1 = getEscapeTempScore(item);
    score2 = getEscapeInfraScore(item);
    score3 = getEscapeLeisureScore(item);
  } else { // car
    score1 = getCarEconomyScore(item);
    score2 = getCarUtilityScore(item);
    score3 = getCarTechScore(item);
  }
  
  const totalWeight = w.geopolitics + w.climate + w.liveability;
  if (totalWeight === 0) return 0;
  
  return (score1 * w.geopolitics + score2 * w.climate + score3 * w.liveability) / totalWeight;
}

// Net votes
function getNetVotes(item) {
  return item.votes.upvotes - item.votes.downvotes;
}

// Unified Sorting algorithm
function sortCountries(list, category, view, w) {
  return [...list].sort((a, b) => {
    let scoreA, scoreB;
    if (view === 'custom') {
      scoreA = getWeightedScore(a, w);
      scoreB = getWeightedScore(b, w);
    } else if (view === 'community') {
      scoreA = getNetVotes(a);
      scoreB = getNetVotes(b);
    } else { // explore
      if (currentScope === 'global') {
        if (category === 'geopolitics') {
          scoreA = getGeopoliticalScore(a);
          scoreB = getGeopoliticalScore(b);
        } else if (category === 'korean-liveability') {
          scoreA = getLiveabilityScore(a);
          scoreB = getLiveabilityScore(b);
        } else { // climate
          scoreA = getClimateScore(a);
          scoreB = getClimateScore(b);
        }
      } else if (currentScope === 'korea') {
        if (category === 'geopolitics') {
          scoreA = getKRDisasterScore(a);
          scoreB = getKRDisasterScore(b);
        } else if (category === 'korean-liveability') {
          scoreA = getKRInfraScore(a);
          scoreB = getKRInfraScore(b);
        } else { // climate
          scoreA = getKRClimateScore(a);
          scoreB = getKRClimateScore(b);
        }
      } else if (currentScope === 'apartment') {
        if (category === 'geopolitics') {
          scoreA = getAptInvestmentScore(a);
          scoreB = getAptInvestmentScore(b);
        } else if (category === 'korean-liveability') {
          scoreA = getAptLiveabilityScore(a);
          scoreB = getAptLiveabilityScore(b);
        } else { // climate
          scoreA = getAptPriceBrandScore(a);
          scoreB = getAptPriceBrandScore(b);
        }
      } else if (currentScope === 'escape') {
        if (category === 'geopolitics') {
          scoreA = getEscapeTempScore(a);
          scoreB = getEscapeTempScore(b);
        } else if (category === 'korean-liveability') {
          scoreA = getEscapeInfraScore(a);
          scoreB = getEscapeInfraScore(b);
        } else { // climate
          scoreA = getEscapeLeisureScore(a);
          scoreB = getEscapeLeisureScore(b);
        }
      } else { // car
        if (category === 'geopolitics') {
          scoreA = getCarEconomyScore(a);
          scoreB = getCarEconomyScore(b);
        } else if (category === 'korean-liveability') {
          scoreA = getCarUtilityScore(a);
          scoreB = getCarUtilityScore(b);
        } else { // climate
          scoreA = getCarTechScore(a);
          scoreB = getCarTechScore(b);
        }
      }
    }
    return scoreB - scoreA;
  });
}

// Render dynamic list
function renderRankings() {
  rankingsListEl.innerHTML = '';
  
  const sorted = sortCountries(countries, selectedCategory, currentView, weights);
  
  const filtered = sorted.filter(item => {
    if (!searchQuery) return true;
    const matchName = item.name.toLowerCase().includes(searchQuery) || item.koreanName.includes(searchQuery);
    if (currentScope === 'car') {
      const matchEngine = item.engineType.includes(searchQuery);
      const matchSize = item.sizeCategory.includes(searchQuery) || (searchQuery === '경차' && item.sizeCategory === '경차');
      return matchName || matchEngine || matchSize;
    }
    return matchName;
  });
  
  if (filtered.length === 0) {
    document.getElementById('search-empty-state').style.display = 'flex';
    return;
  } else {
    document.getElementById('search-empty-state').style.display = 'none';
  }

  filtered.forEach((item, index) => {
    const currentRank = sorted.findIndex(c => c.id === item.id) + 1;
    
    // Rank Change calculations
    let rankDiffHTML = '';
    if (previousRanks[item.id] !== undefined) {
      const diff = previousRanks[item.id] - currentRank;
      if (diff > 0) {
        rankDiffHTML = `<span class="rank-change rank-up"><i class="fa-solid fa-caret-up"></i> ${diff}</span>`;
      } else if (diff < 0) {
        rankDiffHTML = `<span class="rank-change rank-down"><i class="fa-solid fa-caret-down"></i> ${Math.abs(diff)}</span>`;
      } else {
        rankDiffHTML = `<span class="rank-change rank-same"><i class="fa-solid fa-minus"></i></span>`;
      }
    }
    previousRanks[item.id] = currentRank;

    // Scores display config
    let scoreDisplay = 0;
    let metricLabel = '';
    let metricVal = 0;
    
    if (currentView === 'custom') {
      scoreDisplay = Math.round(getWeightedScore(item, weights));
      metricLabel = '가중 합산';
      metricVal = scoreDisplay;
    } else if (currentView === 'community') {
      const net = getNetVotes(item);
      scoreDisplay = net >= 0 ? `+${net}` : net;
      const totalVotes = item.votes.upvotes + item.votes.downvotes;
      metricLabel = '공감율';
      metricVal = totalVotes > 0 ? Math.round((item.votes.upvotes / totalVotes) * 100) : 0;
    } else { // explore
      if (currentScope === 'global') {
        if (selectedCategory === 'geopolitics') {
          scoreDisplay = Math.round(getGeopoliticalScore(item));
          metricLabel = 'GDP 지수';
          metricVal = item.metrics.gdpScore;
        } else if (selectedCategory === 'korean-liveability') {
          scoreDisplay = Math.round(getLiveabilityScore(item));
          metricLabel = '치안 점수';
          metricVal = item.metrics.safety;
        } else { // climate
          scoreDisplay = Math.round(getClimateScore(item));
          metricLabel = '기후 점수';
          metricVal = item.metrics.tempComfort;
        }
      } else if (currentScope === 'korea') {
        if (selectedCategory === 'geopolitics') {
          scoreDisplay = Math.round(getKRDisasterScore(item));
          metricLabel = '방재 지수';
          metricVal = item.metrics.disasterSafety;
        } else if (selectedCategory === 'korean-liveability') {
          scoreDisplay = Math.round(getKRInfraScore(item));
          metricLabel = '인프라력';
          metricVal = item.metrics.livingInfra;
        } else { // climate
          scoreDisplay = Math.round(getKRClimateScore(item));
          metricLabel = '대기/온도';
          metricVal = Math.round(getKRClimateScore(item));
        }
      } else if (currentScope === 'apartment') {
        if (selectedCategory === 'geopolitics') {
          scoreDisplay = Math.round(getAptInvestmentScore(item));
          metricLabel = '투자지수';
          metricVal = item.metrics.investmentValue;
        } else if (selectedCategory === 'korean-liveability') {
          scoreDisplay = Math.round(getAptLiveabilityScore(item));
          metricLabel = '실거주';
          metricVal = item.metrics.livingInfra;
        } else { // climate
          scoreDisplay = Math.round(getAptPriceBrandScore(item));
          metricLabel = '자산단가';
          metricVal = item.metrics.assetValue;
        }
      } else if (currentScope === 'escape') {
        if (selectedCategory === 'geopolitics') {
          scoreDisplay = Math.round(getEscapeTempScore(item));
          metricLabel = '기후쾌적';
          metricVal = Math.round(getEscapeTempScore(item));
        } else if (selectedCategory === 'korean-liveability') {
          scoreDisplay = Math.round(getEscapeInfraScore(item));
          metricLabel = '체류편의';
          metricVal = item.metrics.livingInfra;
        } else { // climate
          scoreDisplay = Math.round(getEscapeLeisureScore(item));
          metricLabel = '자연휴양';
          metricVal = item.metrics.natureLeisure;
        }
      } else { // car
        if (selectedCategory === 'geopolitics') {
          scoreDisplay = Math.round(getCarEconomyScore(item));
          metricLabel = '유지&가성비';
          metricVal = item.metrics.economy;
        } else if (selectedCategory === 'korean-liveability') {
          scoreDisplay = Math.round(getCarUtilityScore(item));
          metricLabel = '실용&패밀리';
          metricVal = item.metrics.utility;
        } else { // climate
          scoreDisplay = Math.round(getCarTechScore(item));
          metricLabel = '테크&성능';
          metricVal = Math.round(getCarTechScore(item));
        }
      }
    }

    let rankClass = '';
    if (currentRank === 1) rankClass = 'rank-1';
    else if (currentRank === 2) rankClass = 'rank-2';
    else if (currentRank === 3) rankClass = 'rank-3';

    const isExpanded = expandedDrawers.has(item.id);
    const cardWrapper = document.createElement('div');
    cardWrapper.className = `glass-panel ranking-card ${rankClass}`;
    
    const isCompared = compareList.includes(item.id);
    const compareBtnClass = isCompared ? 'active' : '';
    const compareBtnText = isCompared ? '비교 제거됨' : (currentScope === 'global' ? '비교 담기' : (currentScope === 'korea' ? '비교 지역 담기' : (currentScope === 'apartment' ? '비교 단지 담기' : (currentScope === 'escape' ? '비교 피서지 담기' : '비교 차량 담기'))));
    
    const hasVotedUp = voteHistory[item.id] === 'up' ? 'style="color: var(--green-solid); border-color: var(--green-solid)"' : '';
    const hasVotedDown = voteHistory[item.id] === 'down' ? 'style="color: var(--danger-solid); border-color: var(--danger-solid)"' : '';

    // Swap detail tiles based on scope
    let detailsMetricsHTML = '';
    if (currentScope === 'global') {
      detailsMetricsHTML = `
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-dollar-sign"></i> 경제 규모 (GDP)</span>
          <div class="metric-tile-value"><span>${item.metrics.gdpScore}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.gdpScore}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-shield-halved"></i> 사회 안전 치안</span>
          <div class="metric-tile-value"><span>${item.metrics.safety}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.safety}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-temperature-half"></i> 날씨 쾌적성</span>
          <div class="metric-tile-value"><span>${item.metrics.tempComfort}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.tempComfort}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-bowl-food"></i> 한식 및 한인 인프라</span>
          <div class="metric-tile-value"><span>${item.metrics.koreanFoodDensity}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.koreanFoodDensity}%"></div></div>
        </div>
      `;
    } else if (currentScope === 'korea') {
      detailsMetricsHTML = `
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-shield-halved"></i> 자연재해 안전</span>
          <div class="metric-tile-value"><span>${item.metrics.disasterSafety}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.disasterSafety}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-temperature-half"></i> 연평균 기온쾌적성</span>
          <div class="metric-tile-value"><span>${item.metrics.tempComfort}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.tempComfort}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-wind"></i> 미세먼지 & 대기질</span>
          <div class="metric-tile-value"><span>${item.metrics.airQuality}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.airQuality}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-hospital"></i> 생활 및 의료 인프라</span>
          <div class="metric-tile-value"><span>${item.metrics.livingInfra}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.livingInfra}%"></div></div>
        </div>
      `;
    } else if (currentScope === 'apartment') {
      detailsMetricsHTML = `
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-chart-line"></i> 미래 투자/재건축 가치</span>
          <div class="metric-tile-value"><span>${item.metrics.investmentValue}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.investmentValue}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-graduation-cap"></i> 명문 학군 & 교통 인프라</span>
          <div class="metric-tile-value"><span>${item.metrics.livingInfra}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.livingInfra}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-won-sign"></i> 평당 최고 자산가치</span>
          <div class="metric-tile-value"><span>${item.metrics.assetValue}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.assetValue}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-building"></i> 단지 규모 & 브랜드 파워</span>
          <div class="metric-tile-value"><span>${item.metrics.brandScale}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.brandScale}%"></div></div>
        </div>
      `;
    } else if (currentScope === 'escape') {
      detailsMetricsHTML = `
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-temperature-low"></i> 7~8월 평균 온도 쾌적</span>
          <div class="metric-tile-value"><span>${item.metrics.tempComfort}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.tempComfort}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-sun"></i> 보송함 (낮은 습도/강수)</span>
          <div class="metric-tile-value"><span>${item.metrics.humidityComfort}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.humidityComfort}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-wallet"></i> 체류 물가 & 편의성</span>
          <div class="metric-tile-value"><span>${item.metrics.livingInfra}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.livingInfra}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-tree"></i> 자연 환경 & 휴양 레저</span>
          <div class="metric-tile-value"><span>${item.metrics.natureLeisure}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.natureLeisure}%"></div></div>
        </div>
      `;
    } else { // car
      detailsMetricsHTML = `
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-gas-pump"></i> 경제성 & 유지 가성비</span>
          <div class="metric-tile-value"><span>${item.metrics.economy}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.economy}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-car-side"></i> 공간 및 패밀리 실용성</span>
          <div class="metric-tile-value"><span>${item.metrics.utility}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.utility}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-gauge-high"></i> 승차감 & 주행 성능</span>
          <div class="metric-tile-value"><span>${item.metrics.performance}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.performance}%"></div></div>
        </div>
        <div class="metric-tile">
          <span class="metric-tile-label"><i class="fa-solid fa-microchip"></i> 첨단 안전 테크 지수</span>
          <div class="metric-tile-value"><span>${item.metrics.tech}점</span></div>
          <div class="metric-tile-bar"><div class="metric-tile-fill" style="width: ${item.metrics.tech}%"></div></div>
        </div>
      `;
    }

    cardWrapper.innerHTML = `
      <div class="rank-badge-wrapper" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div class="rank-badge">${currentRank}</div>
        ${rankDiffHTML}
      </div>
      <div class="country-info-wrapper" onclick="toggleDetails('${item.id}')">
        <span class="country-flag">${item.flag}</span>
        <div class="country-names">
          <span class="country-korean">${item.koreanName}</span>
          <span class="country-english">${item.name}</span>
        </div>
      </div>
      <div class="metric-bar-container hide-mobile" onclick="toggleDetails('${item.id}')">
        <div class="metric-bar-header">
          <span>${metricLabel}</span>
          <span>${metricVal}${currentView === 'community' ? '%' : '점'}</span>
        </div>
        <div class="metric-bar-track">
          <div class="metric-bar-fill" style="width: ${metricVal}%"></div>
        </div>
      </div>
      <div class="score-badge" onclick="toggleDetails('${item.id}')">
        ${scoreDisplay}${currentView === 'community' ? '표' : '점'}
      </div>
      <div style="text-align: center;">
        <button class="tab-btn" style="padding: 8px; border: none; background: transparent; cursor: pointer; color: var(--text-secondary);" onclick="toggleDetails('${item.id}')">
          <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
        </button>
      </div>
      
      <!-- Expanded Drawer -->
      <div class="details-drawer ${isExpanded ? 'expanded' : ''}" id="drawer-${item.id}">
        <div class="details-content">
          <div class="details-intro">
            <h4 style="font-family: var(--font-title); font-size: 16px; font-weight: 700;">
              ${currentScope === 'car' ? '차량 핵심 분석 개요' : '피서지/개체 핵심 개요'}
            </h4>
            <p class="details-desc">${item.description}</p>
            
            ${currentScope === 'car' ? `
              <div class="specs-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px; margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-size: 13px;"><span style="color: var(--text-secondary); width: 100px; display: inline-block;">엔진 / 크기:</span> <strong>${item.engineType || ''} / ${item.sizeCategory || ''}</strong></div>
                <div style="font-size: 13px;"><span style="color: var(--text-secondary); width: 100px; display: inline-block;">예상 구매 가격:</span> <strong>${item.specs?.price || ''}</strong></div>
                <div style="font-size: 13px;"><span style="color: var(--text-secondary); width: 100px; display: inline-block;">연비 / 전비:</span> <strong>${item.specs?.efficiency || ''}</strong></div>
                <div style="font-size: 13px;"><span style="color: var(--text-secondary); width: 100px; display: inline-block;">국내 구매 혜택:</span> <strong style="color: var(--primary-solid);">${item.specs?.benefits || ''}</strong></div>
              </div>
            ` : ''}
            
            ${currentScope === 'apartment' ? `
              <div class="specs-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px; margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-size: 13px;">
                  <span style="color: var(--text-secondary); width: 130px; display: inline-block;">실거래가 연동 상태:</span> 
                  <strong style="color: ${realPrices[item.id]?.isLive ? 'var(--green-solid)' : 'var(--warning-solid)'};">
                    ${realPrices[item.id]?.isLive ? '● 공공데이터포털 실시간 연동 완료' : '⚠ 시뮬레이션 가격 작동 중 (설정 필요)'}
                  </strong>
                </div>
                <div style="font-size: 13px;"><span style="color: var(--text-secondary); width: 130px; display: inline-block;">최근 3개월 평균가:</span> <strong style="color: var(--primary-solid);">${realPrices[item.id]?.avgPrice}억 원 (${item.pyeongSize}평형)</strong></div>
                <div style="font-size: 13px;"><span style="color: var(--text-secondary); width: 130px; display: inline-block;">평당 매매단가:</span> <strong>약 ${realPrices[item.id]?.pyeongPrice.toLocaleString()}만 원 / 평</strong></div>
                <div style="font-size: 13px;">
                  <span style="color: var(--text-secondary); width: 130px; display: inline-block;">최근 3개월 가격 추이:</span> 
                  <strong>
                    ${realPrices[item.id]?.trend[0]}억 ➔ 
                    ${realPrices[item.id]?.trend[1]}억 ➔ 
                    <span style="color: ${realPrices[item.id]?.trend[2] >= realPrices[item.id]?.trend[1] ? 'var(--green-solid)' : 'var(--danger-solid)'}; font-weight: 700;">
                      ${realPrices[item.id]?.trend[2]}억
                      ${realPrices[item.id]?.trend[2] > realPrices[item.id]?.trend[1] ? '▲' : (realPrices[item.id]?.trend[2] < realPrices[item.id]?.trend[1] ? '▼' : '―')}
                    </span>
                  </strong>
                </div>
              </div>
            ` : ''}

            <div class="fun-fact-box" style="margin-top: 10px;">
              <strong>${currentScope === 'car' ? '💡 구매 가이드 및 국내 실차주 TMI' : '💡 7~8월 날씨 쾌적도 & 체류 라이프 상식'}</strong>
              ${item.funFact}
            </div>
          </div>
          
          <div class="details-metrics-container">
            <h4 style="font-family: var(--font-title); font-size: 16px; font-weight: 700; margin-bottom: 12px;">세부 평가지표</h4>
            <div class="details-metrics">
              ${detailsMetricsHTML}
            </div>
          </div>
          
          <!-- Actions -->
          <div class="drawer-actions">
            <button class="action-btn btn-compare ${compareBtnClass}" onclick="toggleCompare('${item.id}')">
              <i class="fa-solid fa-square-plus"></i> ${compareBtnText}
            </button>
            <button class="action-btn vote-up" ${hasVotedUp} onclick="castVote('${item.id}', 'up')">
              <i class="fa-solid fa-thumbs-up"></i> 가보고 싶어요 (${item.votes.upvotes})
            </button>
            <button class="action-btn vote-down" ${hasVotedDown} onclick="castVote('${item.id}', 'down')">
              <i class="fa-solid fa-thumbs-down"></i> 별로예요 (${item.votes.downvotes})
            </button>
          </div>
        </div>
      </div>
    `;
    rankingsListEl.appendChild(cardWrapper);
  });
}

// Toggle detail drawer
window.toggleDetails = function(countryId) {
  if (expandedDrawers.has(countryId)) {
    expandedDrawers.delete(countryId);
  } else {
    expandedDrawers.add(countryId);
  }
  renderRankings();
};

// Add/remove to compare list
window.toggleCompare = function(countryId) {
  const index = compareList.indexOf(countryId);
  if (index > -1) {
    compareList.splice(index, 1);
  } else {
    if (compareList.length >= 3) {
      alert("최대 3개만 비교할 수 있습니다.");
      return;
    }
    compareList.push(countryId);
  }
  updateCompareStickyBar();
  renderRankings();
};

// Remove from compare list
window.removeFromCompare = function(countryId) {
  const index = compareList.indexOf(countryId);
  if (index > -1) {
    compareList.splice(index, 1);
    updateCompareStickyBar();
    renderRankings();
    
    if (viewCompareLayoutEl.style.display === 'block') {
      if (compareList.length < 2) {
        exitCompareMode();
      } else {
        renderCompareView();
      }
    }
  }
};

// Reset comparison bar
window.clearComparison = function() {
  compareList = [];
  updateCompareStickyBar();
  renderRankings();
  exitCompareMode();
};

// Update compare sticky drawer
function updateCompareStickyBar() {
  if (compareList.length >= 2) {
    compareStickyBarEl.classList.add('visible');
  } else {
    compareStickyBarEl.classList.remove('visible');
  }
  
  comparePillsContainerEl.innerHTML = '';
  compareList.forEach(id => {
    const item = countries.find(c => c.id === id);
    if (item) {
      const pill = document.createElement('div');
      pill.className = 'compare-pill';
      pill.innerHTML = `
        <span>${item.flag} ${item.koreanName}</span>
        <i class="fa-solid fa-xmark remove-compare-pill" onclick="removeFromCompare('${item.id}')"></i>
      `;
      comparePillsContainerEl.appendChild(pill);
    }
  });
  
  compareBtnTextEl.textContent = `비교하기 (${compareList.length})`;
}

// Enter Comparison mode
window.enterCompareMode = function() {
  if (compareList.length < 2) {
    alert("비교를 진행하려면 최소 2개 대상을 담아주세요.");
    return;
  }
  
  viewExploreLayoutEl.style.display = 'none';
  compareStickyBarEl.classList.remove('visible');
  viewCompareLayoutEl.style.display = 'block';
  
  renderCompareView();
};

// Exit Comparison mode
window.exitCompareMode = function() {
  viewCompareLayoutEl.style.display = 'none';
  viewExploreLayoutEl.style.display = 'grid';
  updateCompareStickyBar();
};

// Draw comparison dashboard
function renderCompareView() {
  compareGridEl.innerHTML = '';
  
  // Set compare titles dynamically
  const compareTitleText = document.getElementById('compare-title-text');
  if (compareTitleText) {
    if (currentScope === 'global') {
      compareTitleText.innerHTML = '<i class="fa-solid fa-chart-columns" style="color: var(--primary-solid); margin-right: 8px;"></i>국가 정밀 비교 센터';
    } else if (currentScope === 'korea') {
      compareTitleText.innerHTML = '<i class="fa-solid fa-chart-columns" style="color: var(--primary-solid); margin-right: 8px;"></i>국내 지역 종합 안전/환경 비교';
    } else if (currentScope === 'apartment') {
      compareTitleText.innerHTML = '<i class="fa-solid fa-chart-columns" style="color: var(--primary-solid); margin-right: 8px;"></i>아파트 핵심 가치 (1주택 관점) 비교 센터';
    } else if (currentScope === 'escape') {
      compareTitleText.innerHTML = '<i class="fa-solid fa-umbrella-beach" style="color: var(--primary-solid); margin-right: 8px;"></i>글로벌 여름 피서 및 한 달 살기 쾌적지 비교';
    } else { // car
      compareTitleText.innerHTML = '<i class="fa-solid fa-car" style="color: var(--primary-solid); margin-right: 8px;"></i>국내 판매 차량 사양 및 가치 비교 센터';
    }
  }
  
  compareList.forEach(id => {
    const item = countries.find(c => c.id === id);
    if (!item) return;
    
    const card = document.createElement('div');
    card.className = 'glass-panel compare-card';
    
    let compareContentHTML = '';
    
    if (currentScope === 'global') {
      compareContentHTML = `
        <!-- Geopolitics Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-landmark"></i> 지정학 & 종합 국력</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>GDP 규모</span><span class="compare-metric-val">${item.metrics.gdpScore}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.gdpScore}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>군사력 지수</span><span class="compare-metric-val">${item.metrics.militaryScore}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.militaryScore}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>외교 영향력</span><span class="compare-metric-val">${item.metrics.diplomaticScore}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.diplomaticScore}%"></div></div>
          </div>
        </div>
        
        <!-- Climate Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-cloud-sun"></i> 기후 및 환경</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>온도 쾌적도</span><span class="compare-metric-val">${item.metrics.tempComfort}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.tempComfort}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>공기 청정도</span><span class="compare-metric-val">${item.metrics.airQuality}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.airQuality}%"></div></div>
          </div>
        </div>
      `;
    } else if (currentScope === 'korea') {
      compareContentHTML = `
        <!-- Disaster Safety Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-shield-halved"></i> 재해 및 안전 지수</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>자연재해 안전도</span><span class="compare-metric-val">${item.metrics.disasterSafety}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.disasterSafety}%"></div></div>
          </div>
        </div>
        
        <!-- Climate Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-cloud-sun"></i> 기후 및 대기질</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>기온 적합성</span><span class="compare-metric-val">${item.metrics.tempComfort}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.tempComfort}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>초미세먼지 청정도</span><span class="compare-metric-val">${item.metrics.airQuality}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.airQuality}%"></div></div>
          </div>
        </div>
      `;
    } else if (currentScope === 'apartment') {
      compareContentHTML = `
        <!-- Investment Value Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-chart-line"></i> 미래 투자 가치</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>투자 및 재건축 가치</span><span class="compare-metric-val">${item.metrics.investmentValue}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.investmentValue}%"></div></div>
          </div>
        </div>
        
        <!-- Living Infra Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-graduation-cap"></i> 실거주 및 학군</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>교통 & 학군 편리성</span><span class="compare-metric-val">${item.metrics.livingInfra}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.livingInfra}%"></div></div>
          </div>
        </div>
        
        <!-- Asset & Scale Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-building"></i> 자산 가격 & 브랜드 규모</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>평당 자산 가치</span><span class="compare-metric-val">${item.metrics.assetValue}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.assetValue}%"></div></div>
          </div>
        </div>

        <!-- Real Price Compare -->
        <div class="compare-metric-group" style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px; margin-top: 12px;">
          <div class="compare-group-title"><i class="fa-solid fa-won-sign" style="color: var(--primary-solid);"></i> 최근 실거래 비교 (${item.pyeongSize}평형)</div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-secondary); width: 100px; display: inline-block;">3개월 평균가:</span> <strong style="color: var(--primary-solid);">${realPrices[item.id]?.avgPrice}억 원</strong>
          </div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-secondary); width: 100px; display: inline-block;">평당 단가:</span> <strong>약 ${realPrices[item.id]?.pyeongPrice.toLocaleString()}만 원 / 평</strong>
          </div>
          <div style="font-size: 13px;">
            <span style="color: var(--text-secondary); width: 100px; display: inline-block;">연동 정보:</span> <strong>${realPrices[item.id]?.isLive ? '국토부 실시간' : '시뮬레이션 데이터'}</strong>
          </div>
        </div>
      `;
    } else if (currentScope === 'escape') { // escape comparison
      compareContentHTML = `
        <!-- Climate & Humidity Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-temperature-low"></i> 7~8월 날씨 쾌적도</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>평균 기온 쾌적도</span><span class="compare-metric-val">${item.metrics.tempComfort}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.tempComfort}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>보송함 (낮은 습도)</span><span class="compare-metric-val">${item.metrics.humidityComfort}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.humidityComfort}%"></div></div>
          </div>
        </div>
        
        <!-- Stay Cost & Infra Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-wallet"></i> 체류 여건 및 편의성</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>체류 물가 & 인프라</span><span class="compare-metric-val">${item.metrics.livingInfra}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.livingInfra}%"></div></div>
          </div>
        </div>
        
        <!-- Nature & Activity Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-tree"></i> 자연 휴양 환경</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>자연 경관 & 레저</span><span class="compare-metric-val">${item.metrics.natureLeisure}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.natureLeisure}%"></div></div>
          </div>
        </div>
      `;
    } else { // car comparison
      compareContentHTML = `
        <!-- Specs Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-gears"></i> 차량 기본 사양</div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-secondary);">엔진 종류:</span> <strong>${item.engineType || ''}</strong>
          </div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-secondary);">크기 구분:</span> <strong>${item.sizeCategory || ''}</strong>
          </div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-secondary);">예상 가격:</span> <strong>${item.specs?.price || ''}</strong>
          </div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-secondary);">복합 효율:</span> <strong style="color: var(--primary-solid);">${item.specs?.efficiency || ''}</strong>
          </div>
        </div>
        
        <!-- Economy & Utility Compare -->
        <div class="compare-metric-group">
          <div class="compare-group-title"><i class="fa-solid fa-wallet"></i> 가치 지표 비교</div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>경제성/유지비</span><span class="compare-metric-val">${item.metrics.economy}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.economy}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>공간/실용성</span><span class="compare-metric-val">${item.metrics.utility}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${item.metrics.utility}%"></div></div>
          </div>
          <div class="compare-metric-row">
            <div class="compare-metric-label"><span>테크/주행성능</span><span class="compare-metric-val">${Math.round((item.metrics.performance + item.metrics.tech)/2)}점</span></div>
            <div class="compare-bar-track"><div class="compare-bar-fill" style="width: ${Math.round((item.metrics.performance + item.metrics.tech)/2)}%"></div></div>
          </div>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="compare-card-header">
        <div class="compare-card-title">
          <span style="font-family: var(--font-title); font-size: 20px; font-weight: 800;">${item.koreanName}</span>
          <span style="font-size: 13px; color: var(--text-secondary);">${item.name}</span>
        </div>
        <span class="compare-card-flag">${item.flag}</span>
      </div>
      
      ${compareContentHTML}
      
      <div class="fun-fact-box" style="margin-top: 10px;">
        <strong>💡 한 줄 요약</strong>
        ${item.description}
      </div>
    `;
    
    compareGridEl.appendChild(card);
  });
  
  // Smooth bar transitions
  setTimeout(() => {
    const bars = document.querySelectorAll('.compare-bar-fill');
    bars.forEach(bar => {
      const width = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => {
        bar.style.width = width;
      }, 50);
    });
  }, 100);
}

// Voting handler
window.castVote = function(itemId, type) {
  const item = countries.find(c => c.id === itemId);
  if (!item) return;
  
  const currentVote = voteHistory[itemId];
  
  if (currentVote === type) {
    // Retract
    if (type === 'up') item.votes.upvotes--;
    else item.votes.downvotes--;
    delete voteHistory[itemId];
  } else {
    // Modify
    if (currentVote === 'up') item.votes.upvotes--;
    else if (currentVote === 'down') item.votes.downvotes--;
    
    // Cast new
    if (type === 'up') item.votes.upvotes++;
    else item.votes.downvotes++;
    voteHistory[itemId] = type;
  }
  
  // Save vote history based on scope
  if (currentScope === 'global') {
    localStorage.setItem('rankify_votes', JSON.stringify(voteHistory));
    
    const votesToSave = {};
    countries.forEach(c => {
      votesToSave[c.id] = { upvotes: c.votes.upvotes, downvotes: c.votes.downvotes };
    });
    localStorage.setItem('rankify_countries_votes', JSON.stringify(votesToSave));
  } else if (currentScope === 'korea') {
    localStorage.setItem('rankify_votes_regions', JSON.stringify(voteHistory));
    
    const votesToSave = {};
    countries.forEach(c => {
      votesToSave[c.id] = { upvotes: c.votes.upvotes, downvotes: c.votes.downvotes };
    });
    localStorage.setItem('rankify_regions_votes_data', JSON.stringify(votesToSave));
  } else if (currentScope === 'apartment') {
    localStorage.setItem('rankify_votes_apartments', JSON.stringify(voteHistory));
    
    const votesToSave = {};
    countries.forEach(c => {
      votesToSave[c.id] = { upvotes: c.votes.upvotes, downvotes: c.votes.downvotes };
    });
    localStorage.setItem('rankify_apartments_votes_data', JSON.stringify(votesToSave));
  } else if (currentScope === 'escape') {
    localStorage.setItem('rankify_votes_escape', JSON.stringify(voteHistory));
    
    const votesToSave = {};
    countries.forEach(c => {
      votesToSave[c.id] = { upvotes: c.votes.upvotes, downvotes: c.votes.downvotes };
    });
    localStorage.setItem('rankify_escape_votes_data', JSON.stringify(votesToSave));
  } else { // car
    localStorage.setItem('rankify_votes_cars', JSON.stringify(voteHistory));
    
    const votesToSave = {};
    countries.forEach(c => {
      votesToSave[c.id] = { upvotes: c.votes.upvotes, downvotes: c.votes.downvotes };
    });
    localStorage.setItem('rankify_cars_votes_data', JSON.stringify(votesToSave));
  }
  
  renderRankings();
};

// ==========================================
// Real Estate MOLIT API Integration
// ==========================================

let apiKey = localStorage.getItem('rankify_api_key') || '';
let realPrices = {};

const APT_BASE_PRICES = {
  'acro-river-park': 43.0,
  'apgujeong-hyundai': 48.0,
  'raemian-one-bailey': 44.0,
  'hannam-the-hill': 85.0,
  'eunma': 26.0,
  'helio-city': 20.0,
  'mapo-raemian-purigio': 17.5,
  'banpo-jugong-1': 55.0,
  'trimage': 38.0,
  'acro-seoul-forest': 65.0,
  'gyeonghuigung-xi': 19.5,
  'gaepo-dh-firstier': 28.0,
  'mapo-taeyoung': 15.0,
  'shinheung-haneulchae': 10.2,
  'daelim-gangbyeon': 13.0
};

window.initApartmentPrices = function() {
  window.RANKIFY_APARTMENTS_DATA.forEach(apt => {
    const base = APT_BASE_PRICES[apt.id] || 15.0;
    const m1 = base - 0.3;
    const m2 = base;
    const m3 = base + 0.2;
    const avg = (m1 + m2 + m3) / 3;
    const pyeongPrice = (avg * 10000) / apt.pyeongSize;
    realPrices[apt.id] = {
      avgPrice: Math.round(avg * 100) / 100,
      pyeongPrice: Math.round(pyeongPrice),
      trend: [Math.round(m1*100)/100, Math.round(m2*100)/100, Math.round(m3*100)/100],
      isLive: false
    };
  });

  if (apiKey) {
    loadLiveApartmentPrices();
  }
};

async function loadLiveApartmentPrices() {
  const lawdCds = [...new Set(window.RANKIFY_APARTMENTS_DATA.map(a => a.lawdCd))];
  const months = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${yyyy}${mm}`);
  }

  const fetchPromises = [];
  lawdCds.forEach(lawdCd => {
    months.forEach(month => {
      const targetUrl = `https://apis.data.go.kr/1613000/RTMSOBJSvc/getRTMSDataSvcAptTradeDev?serviceKey=${apiKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${month}&_type=json`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      
      const p = fetch(proxyUrl)
        .then(res => res.text())
        .then(text => parseAptData(text, lawdCd, month))
        .catch(err => {
          console.error(`Failed to fetch for LAWD_CD ${lawdCd}, Month ${month}:`, err);
          return [];
        });
      fetchPromises.push(p);
    });
  });

  try {
    const results = await Promise.all(fetchPromises);
    const allTransactions = results.flat();
    
    window.RANKIFY_APARTMENTS_DATA.forEach(apt => {
      const matched = allTransactions.filter(t => {
        return t.lawdCd === apt.lawdCd && t.aptName.includes(apt.apiAptName);
      });

      if (matched.length > 0) {
        const monthlyPrices = {};
        months.forEach(m => monthlyPrices[m] = []);
        
        matched.forEach(t => {
          if (monthlyPrices[t.month]) {
            monthlyPrices[t.month].push(t.price);
          }
        });

        const trend = months.map(m => {
          const prices = monthlyPrices[m];
          if (prices.length > 0) {
            return Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 10) / 10;
          }
          return null;
        });

        const allMatchedPrices = matched.map(t => t.price);
        const avg = allMatchedPrices.reduce((a, b) => a + b, 0) / allMatchedPrices.length;
        const avgInEok = avg / 10000;
        const pyeongPrice = (avgInEok * 10000) / apt.pyeongSize;

        let lastKnownPrice = avgInEok;
        const cleanTrend = trend.map(val => {
          if (val !== null) {
            lastKnownPrice = val / 10000;
          }
          return Math.round(lastKnownPrice * 100) / 100;
        });

        realPrices[apt.id] = {
          avgPrice: Math.round(avgInEok * 100) / 100,
          pyeongPrice: Math.round(pyeongPrice),
          trend: cleanTrend,
          isLive: true
        };
      }
    });

    if (currentScope === 'apartment') {
      renderRankings();
    }
  } catch (err) {
    console.error("Failed to compile live API prices:", err);
  }
}

function parseAptData(text, lawdCd, month) {
  const list = [];
  if (!text || text.trim() === '') return list;

  try {
    if (text.trim().startsWith('<')) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const items = xmlDoc.getElementsByTagName('item');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const aptName = item.getElementsByTagName('apartmentLndgNm')[0]?.textContent || item.getElementsByTagName('아파트')[0]?.textContent || '';
        const priceStr = item.getElementsByTagName('dealAmount')[0]?.textContent || item.getElementsByTagName('거래금액')[0]?.textContent || '0';
        const price = parseInt(priceStr.replace(/,/g, '').trim());
        list.push({ lawdCd, month, aptName, price });
      }
    } else {
      const data = JSON.parse(text);
      const items = data.response?.body?.items?.item || [];
      const itemArray = Array.isArray(items) ? items : [items];
      itemArray.forEach(item => {
        if (item) {
          const aptName = item.apartmentLndgNm || item.아파트 || '';
          const priceStr = String(item.dealAmount || item.거래금액 || '0');
          const price = parseInt(priceStr.replace(/,/g, '').trim());
          list.push({ lawdCd, month, aptName, price });
        }
      });
    }
  } catch (err) {
    console.error('Error parsing response text:', err);
  }
  return list;
}

window.openApiModal = function() {
  document.getElementById('api-modal').style.display = 'flex';
  document.getElementById('api-key-input').value = apiKey;
  updateApiModalStatus();
};

window.closeApiModal = function() {
  document.getElementById('api-modal').style.display = 'none';
};

window.saveApiKey = function() {
  const inputKey = document.getElementById('api-key-input').value.trim();
  apiKey = inputKey;
  localStorage.setItem('rankify_api_key', apiKey);
  window.initApartmentPrices();
  window.closeApiModal();
  alert('API 설정이 저장되었습니다. 아파트 탭에서 실거래가 조회를 시작합니다.');
};

function updateApiModalStatus() {
  const statusEl = document.getElementById('api-test-status');
  if (apiKey) {
    statusEl.textContent = '연동 상태: 설정 완료 (인증키 저장됨)';
    statusEl.style.color = 'var(--green-solid)';
  } else {
    statusEl.textContent = '연동 상태: 미연동 (시뮬레이션 가격 데이터 작동 중)';
    statusEl.style.color = 'var(--warning-solid)';
  }
}

window.testApiKey = function() {
  const inputKey = document.getElementById('api-key-input').value.trim();
  if (!inputKey) {
    alert('인증키를 입력해주세요.');
    return;
  }

  const statusEl = document.getElementById('api-test-status');
  statusEl.textContent = '연동 테스트 진행 중...';
  statusEl.style.color = 'var(--text-secondary)';

  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const month = `${yyyy}${mm}`;

  const targetUrl = `https://apis.data.go.kr/1613000/RTMSOBJSvc/getRTMSDataSvcAptTradeDev?serviceKey=${inputKey}&LAWD_CD=11440&DEAL_YMD=${month}&_type=json`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  fetch(proxyUrl)
    .then(res => res.text())
    .then(text => {
      if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR') || text.includes('SERVICE KEY IS NOT REGISTERED')) {
        statusEl.textContent = '연동 실패: 등록되지 않은 서비스 키입니다. (공공데이터포털 승인 대기 확인 필요)';
        statusEl.style.color = 'var(--danger-solid)';
      } else if (text.includes('OpenAPI_ServiceResponse') && text.includes('<errMsg>')) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const errMsg = xml.getElementsByTagName('errMsg')[0]?.textContent || '상세 알 수 없음';
        statusEl.textContent = `연동 실패: ${errMsg}`;
        statusEl.style.color = 'var(--danger-solid)';
      } else {
        statusEl.textContent = '연동 성공: 정상적으로 연결되었습니다!';
        statusEl.style.color = 'var(--green-solid)';
      }
    })
    .catch(err => {
      console.error(err);
      statusEl.textContent = '연동 실패: 네트워크 또는 프록시 서버 에러입니다.';
      statusEl.style.color = 'var(--danger-solid)';
    });
};

// ==========================================
// Authentication Logic
// ==========================================
async function initAuth() {
  if (supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        currentUser = session.user;
        updateAuthUI(currentUser);
      }
      
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
          currentUser = session.user;
        } else {
          currentUser = null;
        }
        updateAuthUI(currentUser);
      });
    } catch (err) {
      console.error('Failed to initialize Supabase Auth:', err);
    }
  } else {
    const mockUserJson = localStorage.getItem('rankify_mock_user');
    if (mockUserJson) {
      try {
        currentUser = JSON.parse(mockUserJson);
        updateAuthUI(currentUser);
      } catch (e) {
        localStorage.removeItem('rankify_mock_user');
      }
    }
  }
}

window.openAuthModal = function() {
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  const errorEl = document.getElementById('auth-error-msg');
  errorEl.innerText = '';
  errorEl.style.display = 'none';
  
  authMode = 'login';
  updateAuthModalUI();
  
  document.getElementById('auth-modal').style.display = 'flex';
};

window.closeAuthModal = function() {
  document.getElementById('auth-modal').style.display = 'none';
};

window.toggleAuthMode = function(event) {
  if (event) event.preventDefault();
  authMode = authMode === 'login' ? 'signup' : 'login';
  updateAuthModalUI();
};

function updateAuthModalUI() {
  const titleEl = document.getElementById('auth-modal-title');
  const submitEl = document.getElementById('btn-auth-submit');
  const toggleLinkEl = document.getElementById('auth-toggle-link');
  const errorEl = document.getElementById('auth-error-msg');
  
  errorEl.innerText = '';
  errorEl.style.display = 'none';
  
  if (authMode === 'login') {
    titleEl.innerHTML = '<i class="fa-solid fa-user"></i> 로그인';
    submitEl.innerText = '로그인';
    toggleLinkEl.innerText = '회원가입';
    toggleLinkEl.parentElement.innerHTML = '계정이 없으신가요? <a href="#" id="auth-toggle-link" onclick="toggleAuthMode(event)" style="color: var(--primary-solid); text-decoration: underline;">회원가입</a>';
  } else {
    titleEl.innerHTML = '<i class="fa-solid fa-user-plus"></i> 회원가입';
    submitEl.innerText = '회원가입';
    toggleLinkEl.innerText = '로그인';
    toggleLinkEl.parentElement.innerHTML = '이미 계정이 있으신가요? <a href="#" id="auth-toggle-link" onclick="toggleAuthMode(event)" style="color: var(--primary-solid); text-decoration: underline;">로그인</a>';
  }
}

window.submitAuth = async function() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error-msg');
  
  if (!email || !password) {
    errorEl.innerText = '이메일과 비밀번호를 입력해 주세요.';
    errorEl.style.display = 'block';
    return;
  }
  
  if (password.length < 6) {
    errorEl.innerText = '비밀번호는 최소 6자 이상이어야 합니다.';
    errorEl.style.display = 'block';
    return;
  }
  
  const submitEl = document.getElementById('btn-auth-submit');
  const originalText = submitEl.innerText;
  submitEl.disabled = true;
  submitEl.innerText = authMode === 'login' ? '로그인 중...' : '회원가입 중...';
  
  try {
    if (supabaseClient) {
      if (authMode === 'login') {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        currentUser = data.user;
        
        if (data.user && data.session === null) {
          alert('회원가입이 완료되었습니다! 인증 메일이 발송되었을 수 있으니 이메일을 확인하거나 즉시 로그인 해보세요.');
          closeAuthModal();
          return;
        }
      }
    } else {
      currentUser = { email: email, id: 'mock-user-' + Math.random().toString(36).substr(2, 9) };
      localStorage.setItem('rankify_mock_user', JSON.stringify(currentUser));
    }
    
    updateAuthUI(currentUser);
    closeAuthModal();
  } catch (err) {
    errorEl.innerText = err.message || '인증에 실패했습니다.';
    errorEl.style.display = 'block';
  } finally {
    submitEl.disabled = false;
    submitEl.innerText = originalText;
  }
};

window.handleAuthClick = function() {
  if (currentUser) {
    if (confirm('로그아웃 하시겠습니까?')) {
      handleLogout();
    }
  } else {
    openAuthModal();
  }
};

window.handleLogout = async function() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  } else {
    localStorage.removeItem('rankify_mock_user');
  }
  currentUser = null;
  updateAuthUI(null);
};

function updateAuthUI(user) {
  const authBtnTextEl = document.getElementById('auth-btn-text');
  const authIconEl = document.getElementById('auth-icon');
  const authBtnEl = document.getElementById('btn-auth');
  
  if (!authBtnTextEl || !authIconEl || !authBtnEl) return;
  
  if (user) {
    const shortEmail = user.email.split('@')[0];
    authBtnTextEl.innerText = `${shortEmail} (로그아웃)`;
    authIconEl.className = 'fa-solid fa-sign-out-alt';
    authBtnEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    authBtnEl.style.color = 'var(--error-solid)';
  } else {
    authBtnTextEl.innerText = '로그인';
    authIconEl.className = 'fa-solid fa-user';
    authBtnEl.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    authBtnEl.style.color = 'var(--text-secondary)';
  }
}
