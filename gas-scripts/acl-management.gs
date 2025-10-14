/**
 * ACL 관리 함수들
 * 사용자 추가, 삭제, 권한 변경 등
 */

/**
 * 사용자 추가
 */
function addUserToACL(email, role = 'viewer') {
  try {
    const sheet = openAclSheet();
    if (!sheet) {
      throw new Error('ACL sheet not found');
    }
    
    // 중복 확인
    const existingUser = findAclEntryByEmail(email);
    if (existingUser) {
      return createErrorResponse('user_exists', `User ${email} already exists`);
    }
    
    // 새 사용자 추가
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[email, role]]);
    
    return createSuccessResponse({
      message: 'User added successfully',
      email: email,
      role: role
    });
    
  } catch (error) {
    console.error('Error in addUserToACL:', error);
    return createErrorResponse('add_user_error', error.toString());
  }
}

/**
 * 사용자 삭제
 */
function removeUserFromACL(email) {
  try {
    const sheet = openAclSheet();
    if (!sheet) {
      throw new Error('ACL sheet not found');
    }
    
    const data = sheet.getDataRange().getValues();
    const normalizedEmail = normalizeString(email);
    
    for (let i = 1; i < data.length; i++) {
      if (normalizeString(data[i][0]) === normalizedEmail) {
        sheet.deleteRow(i + 1);
        return createSuccessResponse({
          message: 'User removed successfully',
          email: email
        });
      }
    }
    
    return createErrorResponse('user_not_found', `User ${email} not found`);
    
  } catch (error) {
    console.error('Error in removeUserFromACL:', error);
    return createErrorResponse('remove_user_error', error.toString());
  }
}

/**
 * 사용자 권한 변경
 */
function updateUserRole(email, newRole) {
  try {
    const sheet = openAclSheet();
    if (!sheet) {
      throw new Error('ACL sheet not found');
    }
    
    const data = sheet.getDataRange().getValues();
    const normalizedEmail = normalizeString(email);
    
    for (let i = 1; i < data.length; i++) {
      if (normalizeString(data[i][0]) === normalizedEmail) {
        sheet.getRange(i + 1, 2).setValue(newRole);
        return createSuccessResponse({
          message: 'User role updated successfully',
          email: email,
          newRole: newRole
        });
      }
    }
    
    return createErrorResponse('user_not_found', `User ${email} not found`);
    
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    return createErrorResponse('update_role_error', error.toString());
  }
}

/**
 * 모든 사용자 목록 조회
 */
function getAllACLUsers() {
  try {
    const result = readAclEntries();
    if (result.error) {
      return createErrorResponse('acl_read_error', result.error);
    }
    
    return createSuccessResponse({
      users: result.entries,
      count: result.entries.length
    });
    
  } catch (error) {
    console.error('Error in getAllACLUsers:', error);
    return createErrorResponse('get_users_error', error.toString());
  }
}

/**
 * 사용자 권한 확인
 */
function checkUserPermission(email, requiredRole) {
  try {
    const user = findAclEntryByEmail(email);
    if (!user) {
      return createErrorResponse('user_not_found', `User ${email} not found in ACL`);
    }
    
    // 권한 레벨 정의
    const roleLevels = {
      'viewer': 1,
      'editor': 2,
      'manager': 3,
      'admin': 4
    };
    
    const userLevel = roleLevels[user.role] || 0;
    const requiredLevel = roleLevels[requiredRole] || 0;
    
    const hasPermission = userLevel >= requiredLevel;
    
    return createSuccessResponse({
      hasPermission: hasPermission,
      userRole: user.role,
      requiredRole: requiredRole,
      userLevel: userLevel,
      requiredLevel: requiredLevel
    });
    
  } catch (error) {
    console.error('Error in checkUserPermission:', error);
    return createErrorResponse('permission_check_error', error.toString());
  }
}

/**
 * ACL 시트 초기화 (개발용)
 */
function initializeACLSheet() {
  try {
    const sheet = openAclSheet();
    if (!sheet) {
      throw new Error('ACL sheet not found');
    }
    
    // 헤더 설정
    sheet.getRange(1, 1, 1, 2).setValues([['Email', 'Role']]);
    
    // 기본 관리자 추가
    const adminEmail = Session.getActiveUser().getEmail();
    sheet.getRange(2, 1, 1, 2).setValues([[adminEmail, 'admin']]);
    
    return createSuccessResponse({
      message: 'ACL sheet initialized successfully',
      adminEmail: adminEmail
    });
    
  } catch (error) {
    console.error('Error in initializeACLSheet:', error);
    return createErrorResponse('init_acl_error', error.toString());
  }
}
