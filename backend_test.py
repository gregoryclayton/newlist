#!/usr/bin/env python3
import requests
import base64
import json
import time
import os
import sys
from typing import Dict, Any, List, Optional
import uuid

# Get the backend URL from the frontend .env file
BACKEND_URL = "https://6ae7ad66-49fc-4f13-8adb-3983820800bd.preview.emergentagent.com/api"

# Test data
TEST_PROFILE = {
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "bio": "Software engineer with 5 years of experience in Python and JavaScript",
    "avatar": None  # Will be set in the test
}

# Sample image for testing (small base64 encoded 1x1 pixel)
SAMPLE_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

# Test class for organizing the tests
class BackendAPITest:
    def __init__(self):
        self.created_profile_id = None
        self.test_results = {
            "health_check": False,
            "create_profile": False,
            "list_profiles": False,
            "get_profile": False,
            "upload_file": False,
            "add_content": False,
            "delete_profile": False
        }
        
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n=== Running Backend API Tests ===\n")
        
        # Set avatar for test profile
        TEST_PROFILE["avatar"] = SAMPLE_IMAGE_BASE64
        
        # Run tests
        self.test_health_check()
        self.test_create_profile()
        self.test_list_profiles()
        self.test_get_profile()
        self.test_upload_file()
        self.test_add_content_to_profile()
        self.test_delete_profile()
        
        # Print summary
        self.print_summary()
        
    def test_health_check(self):
        """Test the health check endpoint"""
        print("\n--- Testing Health Check Endpoint ---")
        try:
            response = requests.get(f"{BACKEND_URL}/")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            
            if response.status_code == 200 and "message" in response.json():
                self.test_results["health_check"] = True
                print("✅ Health check test passed")
            else:
                print("❌ Health check test failed")
        except Exception as e:
            print(f"❌ Error during health check test: {str(e)}")
    
    def test_create_profile(self):
        """Test creating a user profile"""
        print("\n--- Testing Profile Creation ---")
        try:
            response = requests.post(
                f"{BACKEND_URL}/profiles",
                json=TEST_PROFILE
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
            if response.status_code == 200 and "id" in response.json():
                self.created_profile_id = response.json()["id"]
                self.test_results["create_profile"] = True
                print(f"✅ Profile creation test passed. Profile ID: {self.created_profile_id}")
            else:
                print("❌ Profile creation test failed")
        except Exception as e:
            print(f"❌ Error during profile creation test: {str(e)}")
    
    def test_list_profiles(self):
        """Test listing profiles with pagination"""
        print("\n--- Testing Profile Listing with Pagination ---")
        try:
            # Test default pagination
            response = requests.get(f"{BACKEND_URL}/profiles")
            print(f"Status Code: {response.status_code}")
            print(f"Number of profiles returned: {len(response.json())}")
            
            # Test custom pagination
            response2 = requests.get(f"{BACKEND_URL}/profiles?skip=0&limit=5")
            print(f"Status Code (custom pagination): {response2.status_code}")
            print(f"Number of profiles returned (limit=5): {len(response2.json())}")
            
            if response.status_code == 200 and isinstance(response.json(), list):
                self.test_results["list_profiles"] = True
                print("✅ Profile listing test passed")
            else:
                print("❌ Profile listing test failed")
        except Exception as e:
            print(f"❌ Error during profile listing test: {str(e)}")
    
    def test_get_profile(self):
        """Test getting a specific profile"""
        print("\n--- Testing Individual Profile Retrieval ---")
        if not self.created_profile_id:
            print("❌ Cannot test profile retrieval: No profile ID available")
            return
            
        try:
            response = requests.get(f"{BACKEND_URL}/profiles/{self.created_profile_id}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
            # Test with invalid ID
            invalid_id = str(uuid.uuid4())
            response_invalid = requests.get(f"{BACKEND_URL}/profiles/{invalid_id}")
            print(f"Status Code (invalid ID): {response_invalid.status_code}")
            if response_invalid.status_code != 200:
                print(f"Error response: {response_invalid.text}")
            
            if (response.status_code == 200 and 
                response.json()["id"] == self.created_profile_id and
                response_invalid.status_code == 404):
                self.test_results["get_profile"] = True
                print("✅ Profile retrieval test passed")
            else:
                print("❌ Profile retrieval test failed")
        except Exception as e:
            print(f"❌ Error during profile retrieval test: {str(e)}")
    
    def test_upload_file(self):
        """Test direct file upload endpoint"""
        print("\n--- Testing Direct File Upload ---")
        try:
            # Create a temporary file for testing
            filename = "test_image.png"
            with open(filename, "wb") as f:
                f.write(base64.b64decode(SAMPLE_IMAGE_BASE64))
            
            # Upload the file
            with open(filename, "rb") as f:
                files = {"file": (filename, f, "image/png")}
                response = requests.post(f"{BACKEND_URL}/upload", files=files)
            
            print(f"Status Code: {response.status_code}")
            print(f"Response keys: {list(response.json().keys())}")
            
            # Clean up
            if os.path.exists(filename):
                os.remove(filename)
            
            if (response.status_code == 200 and 
                "content" in response.json() and 
                "file_type" in response.json()):
                self.test_results["upload_file"] = True
                print("✅ File upload test passed")
            else:
                print("❌ File upload test failed")
        except Exception as e:
            print(f"❌ Error during file upload test: {str(e)}")
            # Clean up in case of exception
            if os.path.exists(filename):
                os.remove(filename)
    
    def test_add_content_to_profile(self):
        """Test adding content to a profile"""
        print("\n--- Testing Content Addition to Profile ---")
        if not self.created_profile_id:
            print("❌ Cannot test content addition: No profile ID available")
            return
            
        try:
            # Test adding text content
            text_data = {
                "title": "My Thoughts",
                "content_type": "text",
                "text_content": "This is a sample text content for testing purposes."
            }
            
            response_text = requests.post(
                f"{BACKEND_URL}/profiles/{self.created_profile_id}/content",
                data=text_data
            )
            print(f"Status Code (text content): {response_text.status_code}")
            print(f"Response (text content): {json.dumps(response_text.json(), indent=2)}")
            
            # Test adding file content
            filename = "test_image.png"
            with open(filename, "wb") as f:
                f.write(base64.b64decode(SAMPLE_IMAGE_BASE64))
            
            with open(filename, "rb") as f:
                file_data = {
                    "title": "Test Image",
                    "content_type": "image"
                }
                files = {"file": (filename, f, "image/png")}
                response_file = requests.post(
                    f"{BACKEND_URL}/profiles/{self.created_profile_id}/content",
                    data=file_data,
                    files=files
                )
            
            print(f"Status Code (file content): {response_file.status_code}")
            print(f"Response (file content): {json.dumps(response_file.json(), indent=2)}")
            
            # Clean up
            if os.path.exists(filename):
                os.remove(filename)
            
            # Test with invalid profile ID
            invalid_id = str(uuid.uuid4())
            response_invalid = requests.post(
                f"{BACKEND_URL}/profiles/{invalid_id}/content",
                data=text_data
            )
            print(f"Status Code (invalid ID): {response_invalid.status_code}")
            
            if (response_text.status_code == 200 and 
                response_file.status_code == 200 and
                response_invalid.status_code == 404):
                self.test_results["add_content"] = True
                print("✅ Content addition test passed")
            else:
                print("❌ Content addition test failed")
        except Exception as e:
            print(f"❌ Error during content addition test: {str(e)}")
            # Clean up in case of exception
            if os.path.exists(filename):
                os.remove(filename)
    
    def test_delete_profile(self):
        """Test deleting a profile"""
        print("\n--- Testing Profile Deletion ---")
        if not self.created_profile_id:
            print("❌ Cannot test profile deletion: No profile ID available")
            return
            
        try:
            response = requests.delete(f"{BACKEND_URL}/profiles/{self.created_profile_id}")
            print(f"Status Code: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            
            # Verify deletion by trying to get the profile
            response_get = requests.get(f"{BACKEND_URL}/profiles/{self.created_profile_id}")
            print(f"Status Code (get after delete): {response_get.status_code}")
            
            # Test with invalid ID
            invalid_id = str(uuid.uuid4())
            response_invalid = requests.delete(f"{BACKEND_URL}/profiles/{invalid_id}")
            print(f"Status Code (invalid ID): {response_invalid.status_code}")
            
            if (response.status_code == 200 and 
                response_get.status_code == 404 and
                response_invalid.status_code == 404):
                self.test_results["delete_profile"] = True
                print("✅ Profile deletion test passed")
            else:
                print("❌ Profile deletion test failed")
        except Exception as e:
            print(f"❌ Error during profile deletion test: {str(e)}")
    
    def print_summary(self):
        """Print a summary of all test results"""
        print("\n=== Test Results Summary ===")
        all_passed = True
        for test_name, result in self.test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name}: {status}")
            if not result:
                all_passed = False
        
        print("\nOverall Result:", "✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED")


if __name__ == "__main__":
    tester = BackendAPITest()
    tester.run_all_tests()