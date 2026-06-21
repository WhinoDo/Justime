import os
import subprocess
import sys

def main():
    test_dir = os.path.join(os.path.dirname(__file__), "tests")
    test_files = []
    for root, dirs, files in os.walk(test_dir):
        for file in files:
            if file.startswith("test_") and file.endswith(".py"):
                rel_path = os.path.relpath(os.path.join(root, file), os.path.dirname(__file__))
                test_files.append(rel_path)

    # Sort files to run them deterministically
    test_files.sort()

    print(f"Found {len(test_files)} test files to run in isolation.")
    failed_files = []
    passed_count = 0

    pytest_bin = os.path.join(os.path.dirname(__file__), ".venv", "bin", "pytest")
    if not os.path.exists(pytest_bin):
        pytest_bin = "pytest"

    for idx, test_file in enumerate(test_files, 1):
        print(f"\n[{idx}/{len(test_files)}] Running: {test_file}")
        sys.stdout.flush()
        
        result = subprocess.run(
            [pytest_bin, test_file],
            cwd=os.path.dirname(__file__),
            capture_output=False
        )
        
        if result.returncode == 0:
            print(f"SUCCESS: {test_file}")
            passed_count += 1
        else:
            print(f"FAILED: {test_file} with exit code {result.returncode}")
            failed_files.append(test_file)

    print("\n" + "="*50)
    print(f"Test Execution Summary:")
    print(f"Total files: {len(test_files)}")
    print(f"Passed:      {passed_count}")
    print(f"Failed:      {len(failed_files)}")
    if failed_files:
        print("Failed files:")
        for f in failed_files:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("All tests passed successfully in isolation!")
        sys.exit(0)

if __name__ == "__main__":
    main()
