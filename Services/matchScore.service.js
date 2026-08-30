
export const calculateMatchScore = (userSkills = [], jobSkills = []) => {
  if (!jobSkills || jobSkills.length === 0) return 0;

  //! تحويل المهارات إلى حروف صغيرة وتأمين القيم ضد الفراغات
  const formattedUserSkills = userSkills.map(s => s.trim().toLowerCase());
  const formattedJobSkills = jobSkills.map(s => s.trim().toLowerCase());

  //! حساب عدد المهارات المشتركة
  const matchingSkills = formattedJobSkills.filter(skill => 
    formattedUserSkills.includes(skill)
  );

  //! حساب النسبة المئوية وتقريبها لأقرب رقم صحيح
  const score = (matchingSkills.length / formattedJobSkills.length) * 100;

  return Math.round(score);
};
