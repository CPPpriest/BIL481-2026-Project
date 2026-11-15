package tr.edu.etu.bil481.yztr.core;

public record PackageId(String ecosystem, String name, String version) {

	public String getFullName() {
        return ecosystem + ":" + name + "@" + version;
    }
}
