#!/usr/bin/env python3
"""
Performance benchmark for optimized upload
"""
import time
import asyncio
import aiohttp
import io

async def benchmark_upload():
    """Benchmark the optimized upload endpoint"""
    
    # Create test resume content
    resume_content = """
    JOHN DOE
    Senior Software Engineer
    
    EXPERIENCE:
    • 5+ years Python development
    • AWS cloud architecture
    • React/Node.js full-stack
    • Machine learning projects
    
    SKILLS:
    • Languages: Python, JavaScript, Java
    • Cloud: AWS, Docker, Kubernetes  
    • Frameworks: React, FastAPI, Django
    • Databases: PostgreSQL, MongoDB
    
    PROJECTS:
    • AI Interview System - Built with FastAPI, React, AWS
    • E-commerce Platform - Microservices architecture
    • Data Pipeline - Real-time processing with Kafka
    """.encode()
    
    jd_content = """
    Senior Software Engineer Position
    
    Requirements:
    - 5+ years software development
    - Python and JavaScript expertise
    - AWS cloud experience
    - Full-stack development skills
    """.strip()
    
    url = "http://localhost:8000/upload"
    
    # Prepare multipart form data
    data = aiohttp.FormData()
    data.add_field('resumeFile', 
                   io.BytesIO(resume_content), 
                   filename='test_resume.txt',
                   content_type='text/plain')
    data.add_field('jdText', jd_content)
    
    print("🚀 Testing optimized upload performance...")
    
    async with aiohttp.ClientSession() as session:
        # Warm-up request
        try:
            async with session.post(url, data=data) as response:
                await response.json()
        except:
            pass
        
        # Benchmark runs
        times = []
        for i in range(5):
            # Recreate form data for each request
            test_data = aiohttp.FormData()
            test_data.add_field('resumeFile', 
                               io.BytesIO(resume_content), 
                               filename=f'test_resume_{i}.txt',
                               content_type='text/plain')
            test_data.add_field('jdText', jd_content)
            
            start_time = time.time()
            
            try:
                async with session.post(url, data=test_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        end_time = time.time()
                        duration = end_time - start_time
                        times.append(duration)
                        
                        print(f"✅ Test {i+1}: {duration:.3f}s - Session: {result.get('session_id', 'N/A')[:8]}...")
                    else:
                        print(f"❌ Test {i+1}: HTTP {response.status}")
                        
            except Exception as e:
                print(f"❌ Test {i+1}: {e}")
        
        if times:
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            
            print(f"\n📊 PERFORMANCE RESULTS:")
            print(f"   Average: {avg_time:.3f}s")
            print(f"   Best:    {min_time:.3f}s") 
            print(f"   Worst:   {max_time:.3f}s")
            print(f"   Improvement: ~{((3.0 - avg_time) / 3.0 * 100):.0f}% faster than before")
            
            if avg_time < 1.0:
                print("🎉 EXCELLENT: Sub-second upload processing!")
            elif avg_time < 2.0:
                print("✅ GOOD: Fast upload processing")
            else:
                print("⚠️  SLOW: Needs more optimization")
        else:
            print("❌ All tests failed")

if __name__ == "__main__":
    asyncio.run(benchmark_upload())