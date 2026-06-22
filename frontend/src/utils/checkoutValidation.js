/** 출고 검증 폼 — 이름·항목·수량 등 불일치 안내 */
export function getCheckoutValidationErrors({
  form,
  employee,
  employeeMatches,
  loadingItems,
  quantity,
  selectedSerials,
  knownItemNames,
  availableSerialCount,
  consumableRemaining,
}) {
  if (!form || loadingItems) return [];

  const errors = [];

  if (!form.employeeName?.trim()) {
    errors.push('출고자 이름을 확인할 수 없습니다.');
  } else if (!employee) {
    if (employeeMatches.length === 0) {
      errors.push(`'${form.employeeName}' 임직원을 명단에서 찾을 수 없습니다.`);
    } else if (employeeMatches.length > 1) {
      errors.push(
        `'${form.employeeName}' 동명이인 ${employeeMatches.length}명 — 소속을 선택해 주세요.`
      );
    }
  }

  if (!form.itemName?.trim()) {
    errors.push('품목을 선택해 주세요.');
  } else if (knownItemNames.length > 0 && !knownItemNames.includes(form.itemName)) {
    const sheetLabel = form.itemType === 'consumable' ? '일반 물품' : '시리얼 물품';
    errors.push(`'${form.itemName}' 품목이 ${sheetLabel} 시트에 없습니다.`);
  }

  if (form.itemType === 'consumable' && form.itemName) {
    if (consumableRemaining === null) {
      errors.push(`'${form.itemName}' 품목을 일반 물품 시트에서 찾을 수 없습니다.`);
    } else if (quantity > consumableRemaining) {
      errors.push(
        `재고 부족: ${form.itemName} 잔여 ${consumableRemaining}개, 요청 ${quantity}개`
      );
    }
  }

  if (form.itemType === 'serial' && form.itemName) {
    const filled = selectedSerials.filter(Boolean);
    if (availableSerialCount === 0) {
      errors.push(`'${form.itemName}' 출고 가능한 시리얼이 없습니다.`);
    } else if (quantity > availableSerialCount) {
      errors.push(
        `출고 가능한 ${form.itemName}은(는) ${availableSerialCount}대인데 ${quantity}대를 요청했습니다.`
      );
    } else if (filled.length !== quantity) {
      errors.push(
        `시리얼 번호 ${quantity}개를 선택해 주세요. (현재 ${filled.length}개)`
      );
    } else if (new Set(filled).size !== filled.length) {
      errors.push('같은 시리얼 번호를 중복 선택할 수 없습니다.');
    }
  }

  if (quantity < 1) {
    errors.push('수량은 1 이상이어야 합니다.');
  }

  return errors;
}
