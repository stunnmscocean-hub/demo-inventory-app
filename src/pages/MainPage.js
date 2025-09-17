import React, { useState, useEffect } from 'react';
import { generateExcel, generateExcelWithExcelJS, generateExcelAsImage } from '../utils/excelGenerator'; // Import excel generators and image generator
// import { generatePdf } from '../utils/pdfGenerator'; // PDF generation is no longer used
import { duplicateSpreadsheet, updateGoogleSheetWithData, isGoogleApiReady, initGoogleApis, exportGoogleSheetToPdfAndSaveToDrive, TEMPLATE_SPREADSHEET_ID, TEMPLATE_SHEET_GID, handleAuthClick } from '../utils/googleSheetPdfExporter'; // Import Google Sheet PDF exporter, updater, and readiness checker
import { parseEquipmentCsv, parseUsageCsv, parsePartnerCsv } from '../utils/csvParser';
import styles from './MainPage.module.css';

// Helper function to parse dd/mm/yyyy or yyyy-mm-dd into a Date object
const parseDateString = (dateString) => {
  if (!dateString) return null;
  // yyyy-mm-dd format (from input type="date")
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dateString);
  }
  // dd/mm/yyyy format (from CSV)
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(`${year}-${month}-${day}`); // Convert to yyyy-mm-dd for reliable Date parsing
  }
  // Fallback for other formats
  return new Date(dateString);
};

// Helper function to format a Date object or date string to yyyy/mm/dd
const formatDateToYYYYMMDD = (dateInput) => {
  if (!dateInput) return '';
  const date = (dateInput instanceof Date) ? dateInput : parseDateString(dateInput);
  if (!date || isNaN(date.getTime())) return String(dateInput); // Return original if invalid

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};


// ----------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------

const MainPage = ({ user }) => {
  const [myDemos, setMyDemos] = useState([]);
  const [availableEquipments, setAvailableEquipments] = useState([]);
  const [filteredEquipments, setFilteredEquipments] = useState([]);
  const [allEquipments, setAllEquipments] = useState([]);
  const [allPartners, setAllPartners] = useState([]); // New state for partner data
  const [showInUseEquipment, setShowInUseEquipment] = useState(false);
  const [isMyDemosFolded, setIsMyDemosFolded] = useState(false); // State for folding MyDemoList
  const [loading, setLoading] = useState(true); // New loading state
  const [selectedEquipments, setSelectedEquipments] = useState([]); // State for selected equipments
  // const [excelImage, setExcelImage] = useState(null); // State for Excel image preview (no longer needed for direct PDF export)
  const [showApplicationForm, setShowApplicationForm] = useState(false); // State for showing application form
  const [googleApiLoaded, setGoogleApiLoaded] = useState(false); // State to track Google API readiness
  const [googleTokenClient, setGoogleTokenClient] = useState(null); // State to store tokenClient

  // Custom sorting order
  const customOrder = [
    "Rally Plus", "Rally System", "Rally Camera", "Rally", "Rally Bar", "Rally Bar Mini",
    "Rally Bar Huddle", "MeetUp", "MeetUp 2", "TAP", "TAP IP", "Extend", "SWYTCH", "Logi Dock Flex",
    "Logi Dock", "PTZ Pro 2", "Group", "Sight", "Connect", "BCC950", "Scribe", "Reach",
    "Brio", "MX Brio 705", "C930e", "C925e", "C920e", "C505e",
    "Active USB Cable", "CAT5E Kit for TAP", "Rally Mic Pod Extension Cable", "Strong USB Cable"
  ];

  // Function to clean equipment names for sorting
  const getCleanName = (name) => {
    let clean = name.replace(/\s*\([^)]*\)/g, '').trim(); // Remove text in parentheses
    // Do not remove numbers, as "MeetUp 2" is a distinct item
    return clean;
  };

  // Sorting function
  const sortEquipment = (a, b) => {
    const cleanNameA = getCleanName(a.name);
    const cleanNameB = getCleanName(b.name);

    const rankA = customOrder.indexOf(cleanNameA);
    const rankB = customOrder.indexOf(cleanNameB);

    // Assign a large rank for items not in customOrder to place them at the end
    const finalRankA = rankA === -1 ? customOrder.length : rankA;
    const finalRankB = rankB === -1 ? customOrder.length : rankB;

    // Sort by custom order rank first
    if (finalRankA !== finalRankB) {
      return finalRankA - finalRankB;
    }

    // If custom order ranks are the same (or both not in custom order), sort by clean name alphabetically
    return cleanNameA.localeCompare(cleanNameB);
  };

  useEffect(() => {
    const fetchAllCsvData = async () => {
      setLoading(true); // Set loading to true when fetching starts
      try {
        // Fetch and parse usage data for MyDemoList
        const usageResponse = await fetch('/사용내역.csv');
        const usageText = await usageResponse.text();
        const parsedUsageData = parseUsageCsv(usageText);

        const userPartnerName = (user.name === '테스트사용자' || user.name === 'test') ? '홍길동' : user.name;
        const initialMyDemos = parsedUsageData
          .filter(item => item.partnerName === userPartnerName && item.status === '사용중')
          .map(item => ({
            id: item.id,
            name: item.name,
            serial: item.serial,
            startDate: item.startDate, // Keep as string for now, will be formatted for display
            returnDate: item.returnDate, // Keep as string for now, will be formatted for display
            formSubmitted: false,
            location: '본사'
          }));
        setMyDemos(initialMyDemos);

        // Fetch and parse equipment data for New Application list
        const equipmentResponse = await fetch('/장비현황.csv');
        const equipmentText = await equipmentResponse.text();
        const parsedEquipmentData = parseEquipmentCsv(equipmentText);

        const allEquipmentFromCsv = parsedEquipmentData.map(item => ({
          id: item.id,
          name: item.name,
          serial: item.serial,
          location: item.location,
          status: item.status
        }));
        
        // Apply sorting to all equipment data
        const sortedAllEquipment = [...allEquipmentFromCsv].sort(sortEquipment);
        setAllEquipments(sortedAllEquipment);
        
        const initialFiltered = sortedAllEquipment.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
        setAvailableEquipments(initialFiltered);
        setFilteredEquipments(initialFiltered);

        // Fetch and parse partner data
        const partnerResponse = await fetch('/파트너정보.csv');
        const partnerText = await partnerResponse.text();
        const parsedPartnerData = parsePartnerCsv(partnerText);
        setAllPartners(parsedPartnerData);

      } catch (error) {
        console.error("Error fetching or parsing CSV:", error);
      } finally {
        setLoading(false); // Set loading to false when fetching is complete (success or error)
      }
    };

    fetchAllCsvData();

    // Initialize Google APIs
    const initializeApis = async () => {
      console.log("MainPage: Attempting to initialize Google APIs.");
      const { tokenClient } = await initGoogleApis();
      setGoogleTokenClient(tokenClient);
      setGoogleApiLoaded(true);
      console.log("MainPage: Google API and GIS are ready!");
    };
    initializeApis();

  }, [user.name, showInUseEquipment]);

  const handleSearch = (searchTerm) => {
    const equipmentToFilter = allEquipments.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
    if (!searchTerm) {
      setFilteredEquipments(equipmentToFilter);
      return;
    }
    const filtered = equipmentToFilter.filter(eq => eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.serial.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredEquipments(filtered);
  };
  
  const handleReturn = (demoId) => {
    if (window.confirm("반납 하시겠습니까?")) {
      const returnedDemo = myDemos.find(demo => demo.id === demoId);
      if (returnedDemo) {
        const { id, name, serial } = returnedDemo;
        const updatedReturnedItem = { ...returnedDemo, status: '대여 가능', location: '본사' };
        
        setMyDemos(prev => prev.filter(demo => demo.id !== demoId));
        
        const updatedAllEquipments = [...allEquipments.filter(eq => eq.id !== id), updatedReturnedItem].sort(sortEquipment);
        setAllEquipments(updatedAllEquipments);

        const searchTerm = document.querySelector(`.${styles.searchInput}`)?.value || '';
        const newAvailable = updatedAllEquipments.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
        setAvailableEquipments(newAvailable);
        setFilteredEquipments(newAvailable.filter(eq => 
          eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.serial.toLowerCase().includes(searchTerm.toLowerCase())
        ));
        
        alert("담당자에게 전달해주세요.");
      }
    }
  };

  const handleFormSubmit = (demoId) => {
    alert(`(ID: ${demoId}) 신청 양식을 제출합니다.`);
    const updatedDemos = myDemos.map(demo => demo.id === demoId ? { ...demo, formSubmitted: true } : demo);
    setMyDemos(updatedDemos);
  };
  
  const handleEquipmentToggle = (equipment) => {
    setSelectedEquipments(prev => {
      const isSelected = prev.some(eq => eq.id === equipment.id);
      if (isSelected) {
        return prev.filter(eq => eq.id !== equipment.id);
      } else {
        return [...prev, equipment];
      }
    });
  };

  const handleRemoveEquipment = (equipmentId) => {
    setSelectedEquipments(prev => prev.filter(eq => eq.id !== equipmentId));
  };
  
  const handleNewDemo = (equipmentId, returnDate) => {
    const newDemoItem = availableEquipments.find(eq => eq.id === equipmentId);
    if (newDemoItem) {
      const updatedNewDemoItem = {
        ...newDemoItem,
        status: '사용중',
        startDate: formatDateToYYYYMMDD(new Date()), // Format current date to yyyy/mm/dd
        returnDate: returnDate, // This is already in yyyy/mm/dd format from formData
        formSubmitted: false
      };

      setMyDemos(prev => [...prev, updatedNewDemoItem]);
      
      const updatedAllEquipments = [...allEquipments.filter(eq => eq.id !== equipmentId), updatedNewDemoItem].sort(sortEquipment);
      setAllEquipments(updatedAllEquipments);

      const searchTerm = document.querySelector(`.${styles.searchInput}`)?.value || '';
      const newAvailable = updatedAllEquipments.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
      setAvailableEquipments(newAvailable);
      setFilteredEquipments(newAvailable.filter(eq => 
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.serial.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    }
  };

  const handleMultipleNewDemo = (returnDate) => {
    if (selectedEquipments.length === 0) return;

    const updatedDemos = selectedEquipments.map(equipment => ({
      ...equipment,
      status: '사용중',
      startDate: formatDateToYYYYMMDD(new Date()),
      returnDate: returnDate,
      formSubmitted: false
    }));

    setMyDemos(prev => [...prev, ...updatedDemos]);
    
    const updatedAllEquipments = allEquipments.map(eq => {
      const selected = selectedEquipments.find(sel => sel.id === eq.id);
      if (selected) {
        return {
          ...eq,
          status: '사용중',
          startDate: formatDateToYYYYMMDD(new Date()),
          returnDate: returnDate,
          formSubmitted: false
        };
      }
      return eq;
    }).sort(sortEquipment);
    
    setAllEquipments(updatedAllEquipments);

    const searchTerm = document.querySelector(`.${styles.searchInput}`)?.value || '';
    const newAvailable = updatedAllEquipments.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
    setAvailableEquipments(newAvailable);
    setFilteredEquipments(newAvailable.filter(eq => 
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.serial.toLowerCase().includes(searchTerm.toLowerCase())
    ));

    // Clear selections and hide form
    setSelectedEquipments([]);
    setShowApplicationForm(false);
  };
  
  useEffect(() => {
      // Re-apply search term when availableEquipments changes
      const searchTerm = document.querySelector(`.${styles.searchInput}`)?.value || '';
      const equipmentToFilter = availableEquipments.filter(item => showInUseEquipment ? true : item.status === '대여 가능');
      const filtered = equipmentToFilter.filter(eq => eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.serial.toLowerCase().includes(searchTerm.toLowerCase()));
      setFilteredEquipments(filtered);
  }, [availableEquipments, showInUseEquipment, selectedEquipments]);

  useEffect(() => {
    if (selectedEquipments.length > 0) {
      setShowApplicationForm(true);
    } else {
      setShowApplicationForm(false);
    }
  }, [selectedEquipments]);

  // ----------------------------------------------------------------
  // Sub-components defined within the same file
  // ----------------------------------------------------------------
  const Header = ({ userName }) => (
    <header className={styles.header}>
      <h1 className={styles.headerTitle}>{userName}님, 환영합니다.</h1>
    </header>
  );

  const MyDemoList = ({ demos, onReturn }) => { // Removed onFormSubmit from props
    const isOverdue = (returnDate) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 시간은 비교에서 제외
      const parsedReturnDate = parseDateString(returnDate);
      return parsedReturnDate && parsedReturnDate < today;
    };
    
    return (
      <table>
        <thead>
          <tr>
            <th>장비명</th><th>시리얼 넘버</th><th>대여 시작일</th><th>반납 예정일</th><th>신청 양식</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          {demos.map((demo) => (
            <tr key={demo.id}>
              <td>{demo.name}</td>
              <td>{demo.serial}</td>
              <td>{formatDateToYYYYMMDD(demo.startDate)}</td>
              <td className={isOverdue(demo.returnDate) ? styles.overdue : ''}>
                {formatDateToYYYYMMDD(demo.returnDate)}
                {isOverdue(demo.returnDate) && <span className={styles.overdueText}>(반납일 초과)</span>}
              </td>
              <td>{demo.formSubmitted ? '제출 완료' : <button onClick={() => handleFormSubmit(demo.id)} className="button-primary">제출하기</button>}</td>
              <td><button onClick={() => onReturn(demo.id)} className="button-secondary">반납하기</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const SearchBar = ({ onSearch }) => {
    const [term, setTerm] = useState('');
    
    const handleChange = (e) => {
      const newTerm = e.target.value;
      setTerm(newTerm);
      onSearch(newTerm); // Trigger search on each change
    };
    
    return (
      <div className={styles.searchForm}> {/* Changed from form to div */}
        <input type="text" placeholder="장비 이름 또는 시리얼 넘버로 검색" value={term} onChange={handleChange} className={styles.searchInput}/>
        {/* Removed the search button */}
      </div>
    );
  };

  const NewApplicationForm = ({ equipment, applicantName, onNewDemo, allPartners }) => {
    const todayFormatted = formatDateToYYYYMMDD(new Date()); // Current date for default 반출일자 in yyyy/mm/dd
    const [formData, setFormData] = useState({
      requester: applicantName, // 요청자 (현재 로그인 사용자 이름)
      checkoutDate: todayFormatted, // 반출일자 (현재 날짜 기본 세팅)
      returnDate: '', // 반납일자
      checkoutReason: '', // 반출 사유
      checkoutLocation: '서울시 강남구 테헤란로 445, 2층', // 반출 장소 (서울시 강남구 테헤란로 기본)
      
      // 파트너 정보 (주석 처리 - DB에서 불러올 예정)
      partnerCompanyName: '', // 상호
      partnerBusinessNumber: '', // 사업자번호
      partnerContactPerson: '', // 담당자
      partnerContactNumber: '', // 연락처
      partnerAddress: '', // 주소

      // 사용처 정보
      usageCompanyName: '', // 상호 (필수)
      usageBusinessNumber: '', // 사업자번호
      usageAddress: '', // 주소 (필수)
      usageContactPerson: '', // 담당자 (필수)
      usageContactNumber: '', // 연락처 (필수)
    });

    const [companyNameSearchResults, setCompanyNameSearchResults] = useState([]);
    const [showCompanyNameSearchResults, setShowCompanyNameSearchResults] = useState(false);
    const [contactPersonSearchResults, setContactPersonSearchResults] = useState([]);
    const [showContactPersonSearchResults, setShowContactPersonSearchResults] = useState(false);

    const [memoItems, setMemoItems] = useState(['']); // State to manage memo input fields

    const handleAddMemo = () => {
      if (memoItems.length < 4) { // Limit to a maximum of 4 memo items
        setMemoItems(prev => [...prev, '']); // Add a new empty memo item
      } else {
        alert("메모는 최대 4개까지만 추가할 수 있습니다.");
      }
    };

    const handleMemoChange = (index, value) => {
      setMemoItems(prev => prev.map((item, i) => (i === index ? value : item)));
    };

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));

      if (name === 'partnerCompanyName') {
        handleCompanyNameSearch(value);
      } else if (name === 'partnerContactPerson') {
        handleContactPersonSearch(value);
      }
    };

    const handleCompanyNameSearch = (searchTerm) => {
      if (searchTerm.length > 0) {
        const results = allPartners.filter(partner => 
          partner.companyName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setCompanyNameSearchResults(results);
        setShowCompanyNameSearchResults(true);
      } else {
        setCompanyNameSearchResults([]);
        setShowCompanyNameSearchResults(false);
      }
    };

    const handleContactPersonSearch = (searchTerm) => {
      if (searchTerm.length > 0) {
        const results = allPartners.filter(partner => 
          partner.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setContactPersonSearchResults(results);
        setShowContactPersonSearchResults(true);
      } else {
        setContactPersonSearchResults([]);
        setShowContactPersonSearchResults(false);
      }
    };

    const handlePartnerSelect = (partner) => {
      setFormData(prev => ({
        ...prev,
        partnerCompanyName: partner.companyName,
        partnerBusinessNumber: partner.businessNumber,
        partnerContactPerson: partner.contactPerson,
        partnerContactNumber: partner.contactNumber,
        partnerAddress: partner.address,
      }));
      // Clear all search results after selection
      setShowCompanyNameSearchResults(false);
      setCompanyNameSearchResults([]);
      setShowContactPersonSearchResults(false);
      setContactPersonSearchResults([]);
    };

    const handleDownloadPdf = async (e) => {
      e.preventDefault(); // Prevent default form submission behavior
      alert("이 기능은 현재 MultiEquipmentApplicationForm에서만 지원됩니다. 여러 장비를 선택하여 데모 신청을 진행해주세요.");
      return;
    };
    
    return (
      <div className={styles.formContainer}>
        <h4 className={styles.formTitle}>{equipment.name} ({equipment.serial}) 데모 신청</h4>
        
        <div className={styles.infoBox}>
          <h3>[기본정보]</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField} style={{ gridColumn: '1 / -1' }}><label>요청자 :</label><input type="text" name="requester" value={formData.requester} onChange={handleChange} style={{ width: '120px' }} readOnly /></div>
            <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}><label>반출일자 :</label><input type="text" name="checkoutDate" value={formData.checkoutDate} onChange={handleChange} placeholder="YYYY/MM/DD" style={{ width: '130px' }} readOnly /></div>
            <div className={styles.formField} style={{ gridColumn: '2 / span 1' }}><label>회수일자 :</label><input type="text" name="returnDate" value={formData.returnDate} onChange={handleChange} required placeholder="YYYY/MM/DD" style={{ width: '130px' }} /></div>
            
            <div className={styles.formFieldFullWidth}><label>반출 사유 :</label><input type="text" name="checkoutReason" value={formData.checkoutReason} onChange={handleChange} required style={{ width: '600px', height: '60px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>반출 장소 :</label><input type="text" name="checkoutLocation" value={formData.checkoutLocation} onChange={handleChange} style={{ width: '300px' }} /></div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>[파트너 정보]</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>파트너 상호 *(필수) :</label>
              <div className={styles.inputWithResults}>
              <input type="text" name="partnerCompanyName" value={formData.partnerCompanyName} onChange={handleChange} style={{ width: '150px' }} />
                {showCompanyNameSearchResults && companyNameSearchResults.length > 0 && (
                <ul className={styles.searchResults}>
                    {companyNameSearchResults.map(partner => (
                    <li key={partner.id} onClick={() => handlePartnerSelect(partner)}>
                      {partner.companyName} ({partner.contactPerson})
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>
            <div className={styles.formField}><label>파트너 사업자번호 *(필수) :</label><input type="text" name="partnerBusinessNumber" value={formData.partnerBusinessNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}>
              <label>파트너 담당자 *(필수) :</label>
              <div className={styles.inputWithResults}>
              <input type="text" name="partnerContactPerson" value={formData.partnerContactPerson} onChange={handleChange} style={{ width: '150px' }} />
                {showContactPersonSearchResults && contactPersonSearchResults.length > 0 && (
                <ul className={styles.searchResults}>
                    {contactPersonSearchResults.map(partner => (
                    <li key={partner.id} onClick={() => handlePartnerSelect(partner)}>
                      {partner.contactPerson} ({partner.companyName})
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>
            <div className={styles.formField}><label>파트너 연락처 *(필수) :</label><input type="text" name="partnerContactNumber" value={formData.partnerContactNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            
            <div className={styles.formFieldFullWidth}><label>파트너 주소 *(필수) :</label><input type="text" name="partnerAddress" value={formData.partnerAddress} onChange={handleChange} style={{ width: '500px' }} /></div>
          </div>
          <div><em><div style={{ fontSize: '10px' }}>(파트너 정보는 기존 DB에서 불러올 예정입니다. 현재는 수동 입력)</div></em></div>
        </div>

        <div className={styles.infoBox}>
          <h3>[사용처 정보]<br/>장비 대여서 작성을 위해 사용처(엔드유저)의 정보 전달 부탁드립니다.</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField}><label>사용처 상호 *(필수) :</label><input type="text" name="usageCompanyName" value={formData.usageCompanyName} onChange={handleChange} required style={{ width: '150px' }} /></div>
            <div className={styles.formField}><label>사용처 사업자번호 :</label><input type="text" name="usageBusinessNumber" value={formData.usageBusinessNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            <div className={styles.formField}style={{ gridColumn: '1 / span 1' }}><label>사용처 담당자 *(필수) :</label><input type="text" name="usageContactPerson" value={formData.usageContactPerson} onChange={handleChange} required style={{ width: '150px' }} /></div>
            <div className={styles.formField}><label>사용처 담당자 연락처 *(필수) :</label><input type="text" name="usageContactNumber" value={formData.usageContactNumber} onChange={handleChange} required style={{ width: '150px' }} /></div>
            
            <div className={styles.formFieldFullWidth}><label>사용처 주소 *(필수) :</label><input type="text" name="usageAddress" value={formData.usageAddress} onChange={handleChange} required placeholder="" style={{ width: '500px'}} /></div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>[메모사항]</h3>
          <div className={styles.formGrid}>
            {memoItems.map((memo, index) => (
              <div key={index} className={styles.formFieldFullWidth}>
                <label>메모 {index + 1} :</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => handleMemoChange(index, e.target.value)}
                  style={{ width: '500px' }}
                />
              </div>
            ))}
            <div className={styles.formFieldFullWidth}>
              <button type="button" onClick={handleAddMemo} className="button-secondary">추가하기</button>
            </div>
          </div>
        </div>
        <button onClick={handleDownloadPdf} className="button-primary" disabled>데모 신청 양식 출력(다운로드)</button>
      </div>
    );
  };

  const EquipmentList = ({ equipments, selectedEquipments, onEquipmentToggle }) => {
    return (
      <table>
        <thead>
          <tr>
            <th style={{ width: '40px' }}>선택</th>
            <th>장비명</th>
            <th>시리얼 넘버</th>
            <th>장비 위치</th>
            <th>사용 현황</th>
          </tr>
        </thead>
        <tbody>
          {equipments.map((eq) => {
            const isSelected = selectedEquipments.some(selected => selected.id === eq.id);
            return (
              <tr key={eq.id} className={styles.selectableRow}>
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onEquipmentToggle(eq)}
                    className={styles.equipmentCheckbox}
                  />
                </td>
                <td>{eq.name}</td>
                <td>{eq.serial}</td>
                <td>{eq.location}</td>
                <td>{eq.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const SelectedEquipmentsList = ({ selectedEquipments, onRemoveEquipment }) => {
    if (selectedEquipments.length === 0) return null;

    return (
      <div className={styles.selectedEquipmentsContainer}>
        <div className={styles.selectedEquipmentsHeader}>
          <h3>선택된 장비 ({selectedEquipments.length}개)</h3>
        </div>
        <div className={styles.selectedEquipmentsList}>
          {selectedEquipments.map((equipment) => (
            <div key={equipment.id} className={styles.selectedEquipmentItem}>
              <span className={styles.equipmentInfo}>
                {equipment.name} ({equipment.serial})
              </span>
              <button 
                onClick={() => onRemoveEquipment(equipment.id)}
                className={styles.removeButton}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const MultiEquipmentApplicationForm = ({ selectedEquipments, applicantName, allPartners, onNewDemo, onCancel, isGoogleApiLoaded, googleTokenClient }) => {
    console.log("MultiEquipmentApplicationForm: isGoogleApiLoaded =", isGoogleApiLoaded);
    const todayFormatted = formatDateToYYYYMMDD(new Date());
    const [formData, setFormData] = useState({
      requester: applicantName,
      checkoutDate: todayFormatted,
      returnDate: '',
      checkoutReason: '',
      checkoutLocation: '서울시 강남구 테헤란로 445, 2층',
      partnerCompanyName: '',
      partnerBusinessNumber: '',
      partnerContactPerson: '',
      partnerContactNumber: '',
      partnerAddress: '',
      usageCompanyName: '',
      usageBusinessNumber: '',
      usageAddress: '',
      usageContactPerson: '',
      usageContactNumber: '',
    });

    const [companyNameSearchResults, setCompanyNameSearchResults] = useState([]);
    const [showCompanyNameSearchResults, setShowCompanyNameSearchResults] = useState(false);
    const [contactPersonSearchResults, setContactPersonSearchResults] = useState([]);
    const [showContactPersonSearchResults, setShowContactPersonSearchResults] = useState(false);
    const [memoItems, setMemoItems] = useState(['']);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));

      if (name === 'partnerCompanyName') {
        handleCompanyNameSearch(value);
      } else if (name === 'partnerContactPerson') {
        handleContactPersonSearch(value);
      }
    };

    const handleCompanyNameSearch = (searchTerm) => {
      if (searchTerm.length > 0) {
        const results = allPartners.filter(partner => 
          partner.companyName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setCompanyNameSearchResults(results);
        setShowCompanyNameSearchResults(true);
      } else {
        setCompanyNameSearchResults([]);
        setShowCompanyNameSearchResults(false);
      }
    };

    const handleContactPersonSearch = (searchTerm) => {
      if (searchTerm.length > 0) {
        const results = allPartners.filter(partner => 
          partner.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setContactPersonSearchResults(results);
        setShowContactPersonSearchResults(true);
      } else {
        setContactPersonSearchResults([]);
        setShowContactPersonSearchResults(false);
      }
    };

    const handlePartnerSelect = (partner) => {
      setFormData(prev => ({
        ...prev,
        partnerCompanyName: partner.companyName,
        partnerBusinessNumber: partner.businessNumber,
        partnerContactPerson: partner.contactPerson,
        partnerContactNumber: partner.contactNumber,
        partnerAddress: partner.address,
      }));
      setShowCompanyNameSearchResults(false);
      setCompanyNameSearchResults([]);
      setShowContactPersonSearchResults(false);
      setContactPersonSearchResults([]);
    };

    const handleDownloadPdf = async (e) => {
      e.preventDefault(); // Prevent default form submission behavior
      console.log("MultiEquipmentApplicationForm: handleDownloadPdf called.");
      console.log("Form Data before validation (Multi):", formData);

      if (!formData.returnDate || !formData.checkoutReason || !formData.usageCompanyName || !formData.usageAddress || !formData.usageContactPerson || !formData.usageContactNumber) {
        alert("필수 입력 항목을 모두 채워주세요: 반납일자, 반출 사유, 사용처 상호, 사용처 주소, 사용처 담당자, 사용처 연락처");
        console.log("MultiEquipmentApplicationForm: Validation failed.");
        return;
      }
      console.log("MultiEquipmentApplicationForm: Validation passed.");
      
      const memoData = memoItems.filter(memo => memo.trim() !== '');
      if (memoData.length > 0) {
        formData.memoItems = memoData;
      }

      try {
        console.log("MultiEquipmentApplicationForm: Initiating Google authentication.");
        const accessToken = await new Promise((resolve, reject) => {
          handleAuthClick(googleTokenClient, resolve); // handleAuthClick will resolve with the accessToken
        });

        if (!accessToken) {
          alert("Google 인증에 실패했습니다. 다시 시도해주세요.");
          console.error("MultiEquipmentApplicationForm: Google authentication failed, no access token.");
          return;
        }
        console.log("MultiEquipmentApplicationForm: Google authentication successful, access token obtained.");

        // 1. Duplicate the template spreadsheet
        console.log("MultiEquipmentApplicationForm: Attempting to duplicate spreadsheet.");
        const newSpreadsheetTitle = `장비_대여요청서_${formData.requester}_${new Date().toISOString().slice(0, 10)}`;
        
        let newSpreadsheetId;
        try {
          newSpreadsheetId = await duplicateSpreadsheet(accessToken, TEMPLATE_SPREADSHEET_ID, newSpreadsheetTitle);
          
          if (!newSpreadsheetId) {
            alert("스프레드시트 복제에 실패했습니다. 다시 시도해주세요.");
            console.error("MultiEquipmentApplicationForm: Spreadsheet duplication failed.");
            return;
          }
          alert(`스프레드시트가 성공적으로 복제되었습니다: ${newSpreadsheetTitle}`);
          console.log("MultiEquipmentApplicationForm: Spreadsheet duplicated with ID:", newSpreadsheetId);
        } catch (error) {
          console.error("MultiEquipmentApplicationForm: Error duplicating spreadsheet:", error);
          alert(`스프레드시트 복제 중 오류가 발생했습니다: ${error.message}`);
          return;
        }

        // 2. Update the duplicated Google Sheet with form data
        console.log("MultiEquipmentApplicationForm: Attempting to update duplicated Google Sheet.");
        try {
          const updateSuccess = await updateGoogleSheetWithData(accessToken, newSpreadsheetId, formData, selectedEquipments);
          if (!updateSuccess) {
            alert("복제된 Google Sheet 업데이트에 실패했습니다. 다시 시도해주세요.");
            console.error("MultiEquipmentApplicationForm: Duplicated Google Sheet update failed.");
            return;
          }
          alert("복제된 Google Sheet에 데이터가 성공적으로 업데이트되었습니다.");
          console.log("MultiEquipmentApplicationForm: Duplicated Google Sheet updated successfully.");
        } catch (error) {
          console.error("MultiEquipmentApplicationForm: Error updating Google Sheet:", error);
          alert(`Google Sheet 업데이트 중 오류가 발생했습니다: ${error.message}`);
          return;
        }

        // 3. Export the updated Google Sheet to PDF and save to Drive
        console.log("MultiEquipmentApplicationForm: Attempting to export Google Sheet to PDF and save to Drive.");
        try {
          // TEMPLATE_SHEET_GID is used here, assuming the duplicated sheet has the same GID for its first tab
          const pdfFileId = await exportGoogleSheetToPdfAndSaveToDrive(accessToken, newSpreadsheetId, TEMPLATE_SHEET_GID, `${newSpreadsheetTitle}.pdf`);
          
          if (!pdfFileId) {
            alert("PDF 내보내기 및 Drive 저장에 실패했습니다. 다시 시도해주세요.");
            console.error("MultiEquipmentApplicationForm: PDF export and Drive save failed.");
            return;
          }
          alert(`데모 신청 양식이 PDF로 변환되어 Google Drive에 저장되었습니다. 파일 ID: ${pdfFileId}`);
          console.log("MultiEquipmentApplicationForm: PDF exported and saved to Google Drive with File ID:", pdfFileId);
        } catch (error) {
          console.error("MultiEquipmentApplicationForm: Error exporting to PDF:", error);
          alert(`PDF 내보내기 중 오류가 발생했습니다: ${error.message}`);
          return;
        }

      } catch (error) {
        console.error("MultiEquipmentApplicationForm: Error processing Google Sheet workflow:", error);
        alert("Google Sheet 워크플로우 처리 중 오류가 발생했습니다.");
      }

      onNewDemo(formData.returnDate);
      console.log("MultiEquipmentApplicationForm: onNewDemo called.");
    };

    return (
      <div className={styles.formContainer}>
        <div className={styles.selectedEquipmentsSummary}>
          <h4>선택된 장비 목록:</h4>
          <ul>
            {selectedEquipments.map(equipment => (
              <li key={equipment.id}>{equipment.name} ({equipment.serial})</li>
            ))}
          </ul>
        </div>
        
        <div className={styles.infoBox}>
          <h3>[기본정보]</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField} style={{ gridColumn: '1 / -1' }}><label>요청자 :</label><input type="text" name="requester" value={formData.requester} onChange={handleChange} style={{ width: '120px' }} /></div>
            <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}><label>반출일자 :</label><input type="text" name="checkoutDate" value={formData.checkoutDate} onChange={handleChange} placeholder="YYYY/MM/DD" style={{ width: '130px' }} /></div>
            <div className={styles.formField} style={{ gridColumn: '2 / span 1' }}><label>회수일자 :</label><input type="text" name="returnDate" value={formData.returnDate} onChange={handleChange} required placeholder="YYYY/MM/DD" style={{ width: '130px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>반출 사유 :</label><input type="text" name="checkoutReason" value={formData.checkoutReason} onChange={handleChange} required style={{ width: '600px', height: '60px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>반출 장소 :</label><input type="text" name="checkoutLocation" value={formData.checkoutLocation} onChange={handleChange} style={{ width: '300px' }} /></div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>[파트너 정보]</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>파트너 상호 *(필수) :</label>
              <div className={styles.inputWithResults}>
                <input type="text" name="partnerCompanyName" value={formData.partnerCompanyName} onChange={handleChange} style={{ width: '150px' }} />
                {showCompanyNameSearchResults && companyNameSearchResults.length > 0 && (
                  <ul className={styles.searchResults}>
                    {companyNameSearchResults.map(partner => (
                      <li key={partner.id} onClick={() => handlePartnerSelect(partner)}>
                        {partner.companyName} ({partner.contactPerson})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className={styles.formField}><label>파트너 사업자번호 *(필수) :</label><input type="text" name="partnerBusinessNumber" value={formData.partnerBusinessNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}>
              <label>파트너 담당자 *(필수) :</label>
              <div className={styles.inputWithResults}>
                <input type="text" name="partnerContactPerson" value={formData.partnerContactPerson} onChange={handleChange} style={{ width: '150px' }} />
                {showContactPersonSearchResults && contactPersonSearchResults.length > 0 && (
                  <ul className={styles.searchResults}>
                    {contactPersonSearchResults.map(partner => (
                      <li key={partner.id} onClick={() => handlePartnerSelect(partner)}>
                        {partner.contactPerson} ({partner.companyName})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className={styles.formField}><label>파트너 연락처 *(필수) :</label><input type="text" name="partnerContactNumber" value={formData.partnerContactNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>파트너 주소 *(필수) :</label><input type="text" name="partnerAddress" value={formData.partnerAddress} onChange={handleChange} style={{ width: '500px' }} /></div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <h3>[사용처 정보]</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField}><label>사용처 상호 *(필수) :</label><input type="text" name="usageCompanyName" value={formData.usageCompanyName} onChange={handleChange} required style={{ width: '150px' }} /></div>
            <div className={styles.formField}><label>사용처 사업자번호 :</label><input type="text" name="usageBusinessNumber" value={formData.usageBusinessNumber} onChange={handleChange} style={{ width: '150px' }} /></div>
            <div className={styles.formField} style={{ gridColumn: '1 / span 1' }}><label>사용처 담당자 *(필수) :</label><input type="text" name="usageContactPerson" value={formData.usageContactPerson} onChange={handleChange} required style={{ width: '150px' }} /></div>
            <div className={styles.formField}><label>사용처 담당자 연락처 *(필수) :</label><input type="text" name="usageContactNumber" value={formData.usageContactNumber} onChange={handleChange} required style={{ width: '150px' }} /></div>
            <div className={styles.formFieldFullWidth}><label>사용처 주소 *(필수) :</label><input type="text" name="usageAddress" value={formData.usageAddress} onChange={handleChange} required placeholder="" style={{ width: '500px'}} /></div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button onClick={handleDownloadPdf} className="button-primary" disabled={!isGoogleApiLoaded}>데모 신청 양식 출력(다운로드)</button>
          <button onClick={onCancel} className="button-secondary">취소</button>
        </div>
      </div>
    );
  };

  // MainPage component return statement
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header userName={user.name} />
      
      <div className={styles.mainContent}>
        <div className={`${styles.section} ${styles.myDemoSection} ${isMyDemosFolded ? styles.folded : ''}`}>
          <div className={styles.sectionHeader}>
            <h2>내 데모 현황</h2>
          </div>
          {!isMyDemosFolded && (
            <div className={styles.tableContainer}>
              {myDemos.length > 0 ? (
                <MyDemoList demos={myDemos} onReturn={handleReturn} />
              ) : (
                <p className={styles.noData}>현재 대여 중인 장비가 없습니다.</p>
              )}
            </div>
          )}
          <div className={styles.sectionFooter}>
            <button 
              onClick={() => setIsMyDemosFolded(!isMyDemosFolded)}
              className={styles.foldButton}
            >
              {isMyDemosFolded ? '▼ 펼치기' : '▲ 접기'}
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>새 데모 신청</h2>
            <div className={styles.filterControls}>
              <label className={styles.filterLabel}>
                <input
                  type="checkbox"
                  checked={showInUseEquipment}
                  onChange={(e) => setShowInUseEquipment(e.target.checked)}
                />
                사용 중인 장비도 보기
              </label>
            </div>
          </div>
          
          <div className={styles.searchSection}>
            <SearchBar onSearch={handleSearch} />
          </div>
          
          <div className={styles.tableContainer}>
            <EquipmentList 
              equipments={filteredEquipments} 
              selectedEquipments={selectedEquipments}
              onEquipmentToggle={handleEquipmentToggle}
            />
          </div>

          <SelectedEquipmentsList
            selectedEquipments={selectedEquipments}
            onRemoveEquipment={handleRemoveEquipment}
          />

          {showApplicationForm && selectedEquipments.length > 0 && (
            <div className={styles.applicationFormContainer}>
              <h3>데모 신청 정보</h3>
              <MultiEquipmentApplicationForm 
                selectedEquipments={selectedEquipments}
                applicantName={user.name}
                allPartners={allPartners}
                onNewDemo={handleMultipleNewDemo}
                onCancel={() => setShowApplicationForm(false)}
                isGoogleApiLoaded={googleApiLoaded}
                googleTokenClient={googleTokenClient}
              />
            </div>
          )}

          {/* Excel 이미지 미리보기 (Google Sheet PDF 내보내기로 대체되어 더 이상 필요 없음) */}
        </div>
      </div>
    </div>
  );
};

export default MainPage;
