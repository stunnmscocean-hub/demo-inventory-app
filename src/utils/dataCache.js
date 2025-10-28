// 데이터 캐시 관리 유틸리티

const CACHE_KEYS = {
  EQUIPMENT: 'demo_equipment_cache',
  PARTNER: 'demo_partner_cache',
  MY_DEMOS: 'demo_my_demos_cache'
};

const CACHE_DURATION = 5 * 60 * 1000; // 5분 (캐시 유효 시간)

/**
 * 캐시에 데이터 저장
 */
export const setCacheData = (key, data) => {
  try {
    const cacheObject = {
      data: data,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem(key, JSON.stringify(cacheObject));
    console.log(`✅ [Cache] Saved ${key}:`, data.length, 'items');
  } catch (error) {
    console.error(`❌ [Cache] Failed to save ${key}:`, error);
  }
};

/**
 * 캐시에서 데이터 가져오기
 */
export const getCacheData = (key, maxAge = CACHE_DURATION) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      console.log(`⚠️ [Cache] No cache found for ${key}`);
      return null;
    }

    const cacheObject = JSON.parse(cached);
    const age = Date.now() - cacheObject.timestamp;
    
    console.log(`📦 [Cache] Found ${key} (age: ${Math.round(age / 1000)}s)`);

    // 캐시가 너무 오래되었으면 null 반환 (하지만 삭제하지는 않음 - 백업용)
    if (age > maxAge) {
      console.log(`⏰ [Cache] ${key} is stale (${Math.round(age / 1000)}s old)`);
      return null;
    }

    return cacheObject.data;
  } catch (error) {
    console.error(`❌ [Cache] Failed to get ${key}:`, error);
    return null;
  }
};

/**
 * 캐시 강제 가져오기 (만료 여부 무시)
 */
export const getForceCacheData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const cacheObject = JSON.parse(cached);
    console.log(`🔄 [Cache] Force loading ${key}:`, cacheObject.data.length, 'items');
    return cacheObject.data;
  } catch (error) {
    console.error(`❌ [Cache] Failed to force get ${key}:`, error);
    return null;
  }
};

/**
 * 캐시 삭제
 */
export const clearCache = (key) => {
  try {
    localStorage.removeItem(key);
    console.log(`🗑️ [Cache] Cleared ${key}`);
  } catch (error) {
    console.error(`❌ [Cache] Failed to clear ${key}:`, error);
  }
};

/**
 * 모든 캐시 삭제
 */
export const clearAllCache = () => {
  Object.values(CACHE_KEYS).forEach(key => clearCache(key));
  console.log('🗑️ [Cache] Cleared all cache');
};

/**
 * 두 데이터셋의 차이점 찾기 (변경 감지)
 */
export const findDataChanges = (oldData, newData, idField = 'id') => {
  const changes = {
    added: [],
    updated: [],
    removed: [],
    hasChanges: false
  };

  // 새로운 데이터를 Map으로 변환 (빠른 조회)
  const newDataMap = new Map(newData.map(item => [item[idField], item]));
  const oldDataMap = new Map(oldData.map(item => [item[idField], item]));

  // 추가되거나 변경된 항목 찾기
  newData.forEach(newItem => {
    const id = newItem[idField];
    const oldItem = oldDataMap.get(id);

    if (!oldItem) {
      // 새로 추가된 항목
      changes.added.push(newItem);
      changes.hasChanges = true;
    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      // 변경된 항목
      changes.updated.push(newItem);
      changes.hasChanges = true;
    }
  });

  // 삭제된 항목 찾기
  oldData.forEach(oldItem => {
    const id = oldItem[idField];
    if (!newDataMap.has(id)) {
      changes.removed.push(oldItem);
      changes.hasChanges = true;
    }
  });

  if (changes.hasChanges) {
    console.log('🔄 [Cache] Changes detected:', {
      added: changes.added.length,
      updated: changes.updated.length,
      removed: changes.removed.length
    });
  } else {
    console.log('✅ [Cache] No changes detected');
  }

  return changes;
};

/**
 * 변경사항을 기존 데이터에 적용
 */
export const applyDataChanges = (currentData, changes, idField = 'id') => {
  let updatedData = [...currentData];

  // 삭제된 항목 제거
  if (changes.removed.length > 0) {
    const removedIds = new Set(changes.removed.map(item => item[idField]));
    updatedData = updatedData.filter(item => !removedIds.has(item[idField]));
  }

  // 변경된 항목 업데이트
  if (changes.updated.length > 0) {
    const updatedMap = new Map(changes.updated.map(item => [item[idField], item]));
    updatedData = updatedData.map(item => 
      updatedMap.has(item[idField]) ? updatedMap.get(item[idField]) : item
    );
  }

  // 새로운 항목 추가
  if (changes.added.length > 0) {
    updatedData = [...updatedData, ...changes.added];
  }

  return updatedData;
};

export { CACHE_KEYS };

