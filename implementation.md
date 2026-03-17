# Implementation Plan: Sales Intel Scraping & Dashboard Integration

## Extension Steps:
1. **Live Name Sync**: Replace "Scanning Profile..." with real-time DOM scraped name from LinkedIn.
2. **Advanced Intelligence Scraping**:
   - `Access Email` & `Access Phone` buttons.
   - **Order**:
     - Auto-trigger LinkedIn "Contact Info" modal and extract email and phone number.
     - Scan "About" "Experience" "Education" "services" sections and show the summary list under the name section of extension like short text of these  options and if i do save contact then all these info will save in my  dashboard page people section columns.
     - Don't use the dummy data in the extension of access email and mobile number.
     - Fallback: Show "Not available" status for email or phone number.
3. **Action Buttons**: 
   - `Save Contact` (Direct database sync)Direct show the profile in the dashoboard page people section which i've already designed.
   - `Add to List` (Custom list input)In Add to list there will be option of rename that current profile nad save into the list section of my dashboard page which i've already designed.
4. **UI of extension**:
   - Dont change the UI of extension.
   
## Dashboard Steps:
1. **Enhanced Profiles View**:
   - Table columns: Name, Headline, Email, Phone, Company + Website, Location.
2. **Companies Module**: Show linked companies with full details.
3. **Extension Detail Panel**: 
   - Side-panel for Profile/List/Company clicks.
   - Full display of all extracted data.
4. **UI of dashboard**:
   - Dont change the UI of dashboard .

## Implementation Mode:
- This project will be updated step-by-step.
- Verification will be done after each step.
